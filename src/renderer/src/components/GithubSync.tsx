import { useEffect, useState } from 'react'
import { Github, RefreshCw, LogOut, ExternalLink, Copy, Check } from 'lucide-react'
import { Button, Field, inputCls, Spinner } from './ui'
import { useToast } from './Toast'
import type { GithubStatus, DeviceCode } from '../../../shared/types'

export function GithubSync(): JSX.Element {
  const toast = useToast()
  const [st, setSt] = useState<GithubStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [repo, setRepo] = useState('etsy-tracker-data')
  const [device, setDevice] = useState<DeviceCode | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  async function refresh(): Promise<void> {
    const s = await window.api.github.status()
    setSt(s)
    setClientId(s.clientId)
    if (s.repo) setRepo(s.repo)
  }
  useEffect(() => {
    refresh()
  }, [])

  async function login(): Promise<void> {
    if (!clientId.trim()) {
      toast('请先填写 Client ID', 'error')
      return
    }
    try {
      const d = await window.api.github.deviceStart(clientId.trim())
      setDevice(d)
      setWaiting(true)
      // 自动复制验证码并打开授权页
      await navigator.clipboard.writeText(d.user_code).catch(() => {})
      await window.api.shell.openExternal(d.verification_uri)
      const r = await window.api.github.deviceWait({
        clientId: clientId.trim(),
        deviceCode: d.device_code,
        interval: d.interval
      })
      setWaiting(false)
      setDevice(null)
      if (r.ok) {
        toast(`已登录 GitHub：${r.user}`, 'success')
        refresh()
      } else {
        toast(r.error || '登录失败', 'error')
      }
    } catch (e) {
      setWaiting(false)
      setDevice(null)
      toast(String(e), 'error')
    }
  }

  async function logout(): Promise<void> {
    await window.api.github.logout()
    refresh()
  }

  async function saveRepo(): Promise<void> {
    await window.api.github.setRepo(repo.trim())
    refresh()
  }

  async function sync(): Promise<void> {
    setSyncing(true)
    try {
      await window.api.github.setRepo(repo.trim())
      const r = await window.api.github.sync()
      toast(
        `同步完成：拉取合并 ${r.listingsAdded} 新增/${r.listingsUpdated} 更新 Listing、${r.snapshots} 数据、${r.actions} 动作；图片 ↓${r.imagesPulled} ↑${r.imagesPushed}`,
        'success'
      )
      refresh()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function copyCode(): Promise<void> {
    if (device) {
      await navigator.clipboard.writeText(device.user_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (!st) return <p className="text-sm text-black/40">加载中…</p>

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Github size={18} />
        <h2 className="font-semibold">GitHub 同步</h2>
      </div>
      <p className="mb-4 text-sm text-black/40">
        登录后数据会同步到你 GitHub 上的一个<b>私有仓库</b>，换台设备登录同一账号即可拉到最新数据。
      </p>

      {st.loggedIn ? (
        <>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-sm">
              已登录：<b>{st.user}</b>
              {st.lastSync && (
                <span className="ml-2 text-xs text-black/40">
                  上次同步 {st.lastSync.slice(0, 16).replace('T', ' ')}
                </span>
              )}
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 text-xs text-black/45 hover:text-red-500"
            >
              <LogOut size={13} /> 退出
            </button>
          </div>
          <div className="mb-3">
            <Field label="数据仓库名（私有，自动创建）">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  onBlur={saveRepo}
                />
              </div>
            </Field>
          </div>
          <Button loading={syncing} onClick={sync}>
            <RefreshCw size={15} /> 立即同步
          </Button>
          <p className="mt-2 text-xs text-black/35">
            同步 = 先拉取远端并合并到本地（不删本地数据），再把合并结果推回。多设备轮流用时，每次开始/结束点一下即可。
          </p>
        </>
      ) : waiting && device ? (
        <div className="rounded-xl border border-etsy/30 bg-etsy/5 p-4">
          <p className="mb-2 text-sm">已打开 GitHub 授权页，请在浏览器输入验证码：</p>
          <div className="mb-3 flex items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-1.5 text-lg font-bold tracking-widest">
              {device.user_code}
            </code>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-xs hover:bg-black/10"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} 复制
            </button>
          </div>
          <p className="flex items-center gap-2 text-sm text-black/55">
            <Spinner size={14} /> 等待你在浏览器完成授权…
          </p>
          <button
            onClick={() => window.api.shell.openExternal(device.verification_uri)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-etsy hover:underline"
          >
            没弹出？点这里重新打开授权页 <ExternalLink size={12} />
          </button>
        </div>
      ) : (
        <>
          <Field label="GitHub OAuth App 的 Client ID">
            <input
              className={inputCls}
              value={clientId}
              placeholder="Iv1.xxxxxxxxxxxx / Ov23xxxxxxxx"
              onChange={(e) => setClientId(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={login}>
              <Github size={15} /> 登录 GitHub
            </Button>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="text-xs text-black/45 hover:text-black"
            >
              没有 Client ID？看这里
            </button>
          </div>
          {showHelp && (
            <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.015] p-4 text-xs leading-relaxed text-black/60">
              <p className="mb-1 font-medium text-black/70">一次性设置（约 2 分钟）：</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  打开{' '}
                  <button
                    className="text-etsy hover:underline"
                    onClick={() =>
                      window.api.shell.openExternal('https://github.com/settings/developers')
                    }
                  >
                    github.com/settings/developers
                  </button>{' '}
                  → New OAuth App
                </li>
                <li>Application name 随便填；Homepage URL 填 https://github.com</li>
                <li>Authorization callback URL 填 https://github.com（设备流用不到，随便填合法地址）</li>
                <li>创建后，在 App 详情页勾选 <b>Enable Device Flow</b> 并保存</li>
                <li>复制页面上的 <b>Client ID</b>，粘到上面输入框，点「登录 GitHub」</li>
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  )
}
