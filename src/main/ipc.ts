import { ipcMain, clipboard, dialog, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import os from 'os'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import * as db from './db'
import * as ai from './ai'
import * as github from './github'
import { getSettings, saveSettings } from './settings'
import type {
  AiSettings,
  ListingInput,
  SnapshotInput,
  ActionInput,
  Action,
  Listing,
  StoreSnapshotInput
} from '../shared/types'

function fileToDataUrl(filename: string): string | null {
  const abs = join(db.getImagesDir(), filename)
  if (!existsSync(abs)) return null
  const buf = readFileSync(abs)
  const ext = filename.split('.').pop() || 'png'
  return `data:image/${ext};base64,${buf.toString('base64')}`
}

export function registerIpc(): void {
  // ---------- Listings ----------
  ipcMain.handle('listings:list', () => db.listListings())
  ipcMain.handle('listings:get', (_e, id: number) => db.getListing(id))
  ipcMain.handle('listings:create', (_e, input: ListingInput) => {
    let image_path: string | null = null
    if (input.imageDataUrl) image_path = db.saveImage(input.imageDataUrl, 'listing')
    return db.createListing({
      name: input.name,
      etsy_url: input.etsy_url || null,
      notes: input.notes || null,
      image_path
    })
  })
  ipcMain.handle(
    'listings:update',
    (_e, id: number, patch: Partial<Listing> & { imageDataUrl?: string | null }) => {
      const { imageDataUrl, ...rest } = patch
      const finalPatch: Partial<Listing> = { ...rest }
      if (imageDataUrl) finalPatch.image_path = db.saveImage(imageDataUrl, 'listing')
      return db.updateListing(id, finalPatch)
    }
  )
  ipcMain.handle('listings:delete', (_e, id: number) => db.deleteListing(id))

  // ---------- Snapshots ----------
  ipcMain.handle('snapshots:list', (_e, listingId: number) => db.listSnapshots(listingId))
  ipcMain.handle(
    'snapshots:create',
    (_e, input: Omit<SnapshotInput, 'original_images'> & { imageDataUrls?: string[] }) => {
      const { imageDataUrls, ...rest } = input
      const saved: string[] = []
      for (const url of imageDataUrls || []) {
        if (url) saved.push(db.saveImage(url, 'snap'))
      }
      return db.createSnapshot({
        ...rest,
        original_images: saved.length ? JSON.stringify(saved) : null
      })
    }
  )
  ipcMain.handle('snapshots:delete', (_e, id: number) => db.deleteSnapshot(id))

  // ---------- Actions ----------
  ipcMain.handle('actions:list', (_e, listingId: number) => db.listActions(listingId))
  ipcMain.handle(
    'actions:create',
    (_e, input: ActionInput & { imageDataUrls?: string[] }) => {
      const { imageDataUrls, ...rest } = input
      const saved: string[] = []
      for (const url of imageDataUrls || []) {
        if (url) saved.push(db.saveImage(url, 'action'))
      }
      return db.createAction({
        ...rest,
        images: saved.length ? JSON.stringify(saved) : rest.images ?? null
      })
    }
  )
  ipcMain.handle('actions:update', (_e, id: number, patch: Partial<Action>) =>
    db.updateAction(id, patch)
  )
  ipcMain.handle('actions:delete', (_e, id: number) => db.deleteAction(id))

  // ---------- Images ----------
  ipcMain.handle('image:dataUrl', (_e, filename: string) => fileToDataUrl(filename))

  // ---------- Clipboard ----------
  ipcMain.handle('clipboard:image', () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    return img.toDataURL()
  })

  // ---------- AI ----------
  ipcMain.handle('ai:extractAds', (_e, dataUrl: string) => ai.extractAds(dataUrl))
  ipcMain.handle('ai:extractOrganic', (_e, dataUrl: string) => ai.extractOrganic(dataUrl))
  ipcMain.handle('ai:extractFavorites', (_e, dataUrl: string) => ai.extractFavorites(dataUrl))
  ipcMain.handle('ai:summarizeAction', (_e, raw: string) => ai.summarizeAction(raw))
  ipcMain.handle('ai:extractSnapshotText', (_e, text: string) => ai.extractSnapshotFromText(text))
  ipcMain.handle('ai:summarizeListing', (_e, ctx: string) => ai.summarizeListing(ctx))
  ipcMain.handle('ai:test', () => ai.testConnection())
  ipcMain.handle('ai:listModels', (_e, override?: { baseUrl?: string; apiKey?: string }) =>
    ai.listModels(override)
  )

  // ---------- Settings ----------
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, s: AiSettings) => saveSettings(s))

  // ---------- Backup ----------
  ipcMain.handle('backup:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: '导出备份',
      defaultPath: `etsy-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Backup', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { ok: false }
    const data = db.exportAll()
    // 将所有图片以 base64 打包进同一个文件
    const images: Record<string, string> = {}
    for (const f of readdirSync(db.getImagesDir())) {
      try {
        images[f] = readFileSync(join(db.getImagesDir(), f)).toString('base64')
      } catch {
        /* skip */
      }
    }
    const meta = {
      version: 2,
      exportedAt: new Date().toISOString(),
      device: os.hostname(),
      counts: {
        listings: data.listings.length,
        snapshots: data.snapshots.length,
        actions: data.actions.length
      }
    }
    writeFileSync(filePath, JSON.stringify({ ...meta, ...data, images }, null, 2))
    return { ok: true, filePath }
  })

  ipcMain.handle('backup:import', async (_e, mode: 'merge' | 'replace' = 'merge') => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: mode === 'replace' ? '覆盖式导入（替换全部本地数据）' : '合并导入（补充/更新，不删除本地数据）',
      properties: ['openFile'],
      filters: [{ name: 'Backup', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return { ok: false }
    let parsed: {
      listings?: unknown[]
      snapshots?: unknown[]
      actions?: unknown[]
      images?: Record<string, string>
    }
    try {
      parsed = JSON.parse(readFileSync(filePaths[0], 'utf-8'))
    } catch {
      return { ok: false, error: '文件不是有效的备份 JSON。' }
    }
    if (!parsed.listings) return { ok: false, error: '文件缺少数据，可能不是本应用导出的备份。' }
    // 还原图片（同名即同内容，直接写入）
    if (parsed.images) {
      for (const [name, b64] of Object.entries(parsed.images)) {
        writeFileSync(join(db.getImagesDir(), name), Buffer.from(b64, 'base64'))
      }
    }
    const p = parsed as Record<string, unknown[]>
    const payload = {
      listings: (p.listings || []) as never[],
      snapshots: (p.snapshots || []) as never[],
      actions: (p.actions || []) as never[],
      shops: (p.shops || []) as never[],
      storeSnapshots: (p.storeSnapshots || []) as never[],
      storeChats: (p.storeChats || []) as never[]
    }
    if (mode === 'replace') {
      db.importAll(payload)
      return { ok: true, mode }
    }
    const stat = db.importMerge(payload)
    return { ok: true, mode, stat }
  })

  // ---------- 整店分析 ----------
  ipcMain.handle('shops:list', () => db.listShops())
  ipcMain.handle('shops:get', (_e, id: number) => db.getShop(id))
  ipcMain.handle('shops:create', (_e, input: { name: string; notes: string | null }) =>
    db.createShop({ name: input.name, notes: input.notes || null })
  )
  ipcMain.handle('shops:update', (_e, id: number, patch: Record<string, unknown>) =>
    db.updateShop(id, patch)
  )
  ipcMain.handle('shops:delete', (_e, id: number) => db.deleteShop(id))

  ipcMain.handle(
    'storeSnapshots:create',
    (
      _e,
      input: Omit<StoreSnapshotInput, 'original_images'> & { imageDataUrls?: string[] }
    ) => {
      const { imageDataUrls, ...rest } = input
      const saved: string[] = []
      for (const url of imageDataUrls || []) if (url) saved.push(db.saveImage(url, 'store'))
      return db.createStoreSnapshot({
        ...rest,
        original_images: saved.length ? JSON.stringify(saved) : null
      })
    }
  )
  ipcMain.handle('storeSnapshots:list', (_e, shopId: number) => db.listStoreSnapshots(shopId))
  ipcMain.handle('storeSnapshots:delete', (_e, id: number) => db.deleteStoreSnapshot(id))

  ipcMain.handle('storeChats:list', (_e, shopId: number) => db.listStoreChats(shopId))
  ipcMain.handle('storeChats:clear', (_e, shopId: number) => db.clearStoreChats(shopId))

  ipcMain.handle('ai:extractStoreStats', (_e, dataUrl: string) => ai.extractStoreStats(dataUrl))
  ipcMain.handle('ai:extractStoreAds', (_e, dataUrl: string) => ai.extractStoreAds(dataUrl))
  ipcMain.handle('ai:extractStoreAdsText', (_e, text: string) => ai.extractStoreAdsFromText(text))
  ipcMain.handle('ai:storeAdvice', async (_e, shopId: number, context: string) => {
    const text = await ai.storeAdvice(context)
    db.updateShop(shopId, { ai_advice: text, ai_advice_at: new Date().toISOString() })
    return text
  })
  ipcMain.handle('ai:storeChat', async (_e, shopId: number, userMessage: string, context: string) => {
    db.addStoreChat(shopId, 'user', userMessage)
    const history = db.listStoreChats(shopId).map((c) => ({ role: c.role, content: c.content }))
    const answer = await ai.storeChat(context, history)
    return db.addStoreChat(shopId, 'assistant', answer)
  })

  ipcMain.handle('backup:dataDir', () => db.getDataDir())

  // ---------- GitHub 同步 ----------
  ipcMain.handle('github:status', () => github.status())
  ipcMain.handle('github:deviceStart', (_e, clientId: string) => github.deviceStart(clientId))
  ipcMain.handle(
    'github:deviceWait',
    (_e, opts: { clientId: string; deviceCode: string; interval: number }) =>
      github.deviceWait(opts)
  )
  ipcMain.handle('github:logout', () => github.logout())
  ipcMain.handle('github:setRepo', (_e, repo: string) => github.setRepo(repo))
  ipcMain.handle('github:sync', () => github.sync())

  // ---------- 打开外部链接 ----------
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
}
