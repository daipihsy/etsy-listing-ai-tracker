import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import * as db from './db'
import { getGithub, saveGithub } from './settings'
import type { DeviceCode, GithubStatus, SyncResult } from '../shared/types'

const GH_API = 'https://api.github.com'

// ---------------- OAuth 设备流 ----------------

export async function deviceStart(clientId: string): Promise<DeviceCode> {
  if (!clientId) throw new Error('请先填写 GitHub OAuth App 的 Client ID。')
  saveGithub({ clientId })
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: 'repo' })
  })
  if (!res.ok) throw new Error(`获取设备码失败 ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const d = (await res.json()) as DeviceCode & { error?: string; error_description?: string }
  if (d.error) throw new Error(d.error_description || d.error)
  return {
    device_code: d.device_code,
    user_code: d.user_code,
    verification_uri: d.verification_uri,
    expires_in: d.expires_in,
    interval: d.interval || 5
  }
}

// 轮询直到用户在浏览器完成授权（或超时）。成功后保存 token 与用户名。
export async function deviceWait(opts: {
  clientId: string
  deviceCode: string
  interval: number
}): Promise<{ ok: boolean; user?: string; error?: string }> {
  let interval = Math.max(opts.interval || 5, 5)
  const deadline = Date.now() + 15 * 60 * 1000 // 最多等 15 分钟

  while (Date.now() < deadline) {
    await sleep(interval * 1000)
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: opts.clientId,
        device_code: opts.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const d = (await res.json()) as {
      access_token?: string
      error?: string
      interval?: number
    }
    if (d.access_token) {
      const user = await fetchUser(d.access_token)
      saveGithub({ token: d.access_token, user })
      return { ok: true, user }
    }
    switch (d.error) {
      case 'authorization_pending':
        break // 继续等
      case 'slow_down':
        interval += 5
        break
      case 'expired_token':
        return { ok: false, error: '验证码已过期，请重新登录。' }
      case 'access_denied':
        return { ok: false, error: '授权被取消。' }
      default:
        if (d.error) return { ok: false, error: d.error }
    }
  }
  return { ok: false, error: '登录超时，请重试。' }
}

async function fetchUser(token: string): Promise<string> {
  const res = await gh(token, 'GET', '/user')
  const j = (await res.json()) as { login?: string }
  return j.login || ''
}

export function logout(): GithubStatus {
  saveGithub({ token: '', user: '' })
  return status()
}

export function status(): GithubStatus {
  const g = getGithub()
  return {
    loggedIn: !!g.token,
    clientId: g.clientId,
    user: g.user,
    repo: g.repo,
    lastSync: g.lastSync
  }
}

export function setRepo(repo: string): GithubStatus {
  saveGithub({ repo: repo.trim() || 'etsy-tracker-data' })
  return status()
}

// ---------------- REST 帮助 ----------------

async function gh(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  accept = 'application/vnd.github+json'
): Promise<Response> {
  return fetch(`${GH_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
}

// ---------------- 仓库 ----------------

async function ensureRepo(token: string, user: string, repo: string): Promise<void> {
  const r = await gh(token, 'GET', `/repos/${user}/${repo}`)
  if (r.status === 200) return
  if (r.status !== 404) throw new Error(`检查仓库失败 ${r.status}: ${(await r.text()).slice(0, 200)}`)
  // 不存在 → 创建私有仓库
  const c = await gh(token, 'POST', '/user/repos', {
    name: repo,
    private: true,
    auto_init: true,
    description: 'Etsy Listing AI Tracker 数据同步（自动创建，请勿手动修改）'
  })
  if (!c.ok) throw new Error(`创建仓库失败 ${c.status}: ${(await c.text()).slice(0, 200)}`)
}

async function getDefaultBranch(token: string, user: string, repo: string): Promise<string> {
  const r = await gh(token, 'GET', `/repos/${user}/${repo}`)
  const j = (await r.json()) as { default_branch?: string }
  return j.default_branch || 'main'
}

// 读取文件：返回内容字符串与 sha（用于更新）。不存在返回 null。
async function getFile(
  token: string,
  user: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const r = await gh(token, 'GET', `/repos/${user}/${repo}/contents/${encodeURIComponent(path)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`读取 ${path} 失败 ${r.status}`)
  const j = (await r.json()) as { content?: string; encoding?: string; sha: string; download_url?: string }
  if (j.content && j.encoding === 'base64') {
    return { content: Buffer.from(j.content, 'base64').toString('utf-8'), sha: j.sha }
  }
  // 大文件 content 为空，走 raw 下载
  if (j.download_url) {
    const raw = await fetch(j.download_url, { headers: { Authorization: `Bearer ${token}` } })
    return { content: await raw.text(), sha: j.sha }
  }
  return { content: '', sha: j.sha }
}

async function putFile(
  token: string,
  user: string,
  repo: string,
  path: string,
  contentBase64: string,
  sha?: string
): Promise<void> {
  const r = await gh(token, 'PUT', `/repos/${user}/${repo}/contents/${encodeURIComponent(path)}`, {
    message: `sync ${path} ${new Date().toISOString()}`,
    content: contentBase64,
    ...(sha ? { sha } : {})
  })
  if (!r.ok) throw new Error(`上传 ${path} 失败 ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

// 列出 images/ 下所有文件名（用 git tree，支持大量文件）
async function listRemoteImages(token: string, user: string, repo: string): Promise<Set<string>> {
  const branch = await getDefaultBranch(token, user, repo)
  const r = await gh(token, 'GET', `/repos/${user}/${repo}/git/trees/${branch}?recursive=1`)
  if (!r.ok) return new Set()
  const j = (await r.json()) as { tree?: { path: string; type: string }[] }
  const set = new Set<string>()
  for (const n of j.tree || []) {
    if (n.type === 'blob' && n.path.startsWith('images/')) set.add(n.path.slice('images/'.length))
  }
  return set
}

async function downloadImage(
  token: string,
  user: string,
  repo: string,
  name: string
): Promise<void> {
  const r = await gh(
    token,
    'GET',
    `/repos/${user}/${repo}/contents/${encodeURIComponent('images/' + name)}`,
    undefined,
    'application/vnd.github.raw'
  )
  if (!r.ok) return
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(join(db.getImagesDir(), name), buf)
}

// ---------------- 数据打包 / 应用 ----------------

// 生成推送用的数据包，version 是本次唯一标识（用于设备间判断新旧）
function buildStructured(): { str: string; version: string } {
  const data = db.exportAll()
  const version = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const str = JSON.stringify({
    schema: 3,
    version,
    exportedAt: new Date().toISOString(),
    listings: data.listings,
    snapshots: data.snapshots,
    actions: data.actions,
    shops: data.shops,
    storeSnapshots: data.storeSnapshots,
    storeChats: data.storeChats
  })
  return { str, version }
}

// 覆盖本地前先备份本地数据到用户目录，防止误覆盖丢失
function backupLocalBeforePull(): void {
  try {
    const dir = join(db.getDataDir(), 'sync-backups')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(dir, `before-pull-${ts}.json`), JSON.stringify(db.exportAll()))
  } catch {
    /* 备份失败不阻塞同步 */
  }
}

// ---------------- 同步主流程 ----------------

export async function sync(): Promise<SyncResult> {
  const g = getGithub()
  if (!g.token) throw new Error('尚未登录 GitHub。')
  if (!g.user) throw new Error('未获取到 GitHub 用户名，请重新登录。')
  const { token, user, repo } = g

  await ensureRepo(token, user, repo)

  const result: SyncResult = {
    mode: 'pushed',
    listings: 0,
    snapshots: 0,
    actions: 0,
    shops: 0,
    storeSnapshots: 0,
    imagesPulled: 0,
    imagesPushed: 0
  }

  const remote = await getFile(token, user, repo, 'data.json')
  let remoteObj: Record<string, unknown[]> & { version?: string } = {}
  let remoteVersion = ''
  if (remote && remote.content) {
    try {
      remoteObj = JSON.parse(remote.content)
      const rv = remoteObj.version
      // 仅接受新格式版本号（含 '-'）；旧格式(数字)视为无版本，按「本地为准」推送
      remoteVersion = typeof rv === 'string' && rv.includes('-') ? rv : ''
    } catch {
      throw new Error('远端 data.json 解析失败，同步中止（本地数据未改动）。')
    }
  }

  const remoteImages = await listRemoteImages(token, user, repo)
  const localImagesNow = new Set(
    existsSync(db.getImagesDir()) ? readdirSync(db.getImagesDir()) : []
  )

  // 云端有比本设备上次同步更新的版本 → 以云端为准，整体覆盖本地（含删除）
  if (remoteVersion && remoteVersion !== g.remoteVersion) {
    backupLocalBeforePull()
    // 先拉本地缺失的图片
    for (const name of remoteImages) {
      if (!localImagesNow.has(name)) {
        await downloadImage(token, user, repo, name)
        result.imagesPulled++
      }
    }
    db.importAll({
      listings: (remoteObj.listings || []) as never[],
      snapshots: (remoteObj.snapshots || []) as never[],
      actions: (remoteObj.actions || []) as never[],
      shops: (remoteObj.shops || []) as never[],
      storeSnapshots: (remoteObj.storeSnapshots || []) as never[],
      storeChats: (remoteObj.storeChats || []) as never[]
    })
    saveGithub({ remoteVersion, lastSync: new Date().toISOString() })
    const t = db.exportAll()
    result.mode = 'pulled'
    result.listings = t.listings.length
    result.snapshots = t.snapshots.length
    result.actions = t.actions.length
    result.shops = t.shops.length
    result.storeSnapshots = t.storeSnapshots.length
    return result
  }

  // 否则：本地为准 → 整体镜像推送（新增会上传、删除会随之从云端消失）
  const { str, version } = buildStructured()
  await putFile(token, user, repo, 'data.json', Buffer.from(str, 'utf-8').toString('base64'), remote?.sha)
  // 推送远端缺失的图片（图片不可变，只新增不删）
  for (const name of readdirSync(db.getImagesDir())) {
    if (!remoteImages.has(name)) {
      const b64 = readFileSync(join(db.getImagesDir(), name)).toString('base64')
      await putFile(token, user, repo, `images/${name}`, b64)
      result.imagesPushed++
    }
  }
  saveGithub({ remoteVersion: version, lastSync: new Date().toISOString() })
  const t = db.exportAll()
  result.mode = 'pushed'
  result.listings = t.listings.length
  result.snapshots = t.snapshots.length
  result.actions = t.actions.length
  result.shops = t.shops.length
  result.storeSnapshots = t.storeSnapshots.length
  return result
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
