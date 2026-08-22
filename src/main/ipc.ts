import { ipcMain, clipboard, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import * as db from './db'
import * as ai from './ai'
import { getSettings, saveSettings } from './settings'
import type { AiSettings, ListingInput, SnapshotInput, ActionInput, Action, Listing } from '../shared/types'

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
  ipcMain.handle('actions:create', (_e, input: ActionInput) => db.createAction(input))
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
    writeFileSync(filePath, JSON.stringify({ version: 1, ...data, images }, null, 2))
    return { ok: true, filePath }
  })

  ipcMain.handle('backup:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: '导入备份（将覆盖当前数据）',
      properties: ['openFile'],
      filters: [{ name: 'Backup', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return { ok: false }
    const parsed = JSON.parse(readFileSync(filePaths[0], 'utf-8'))
    // 还原图片
    if (parsed.images) {
      for (const [name, b64] of Object.entries<string>(parsed.images)) {
        writeFileSync(join(db.getImagesDir(), name), Buffer.from(b64, 'base64'))
      }
    }
    db.importAll({
      listings: parsed.listings || [],
      snapshots: parsed.snapshots || [],
      actions: parsed.actions || []
    })
    return { ok: true }
  })

  ipcMain.handle('backup:dataDir', () => db.getDataDir())
}
