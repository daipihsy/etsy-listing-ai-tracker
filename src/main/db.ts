import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import type {
  Listing,
  Snapshot,
  Action,
  SnapshotInput,
  ActionInput
} from '../shared/types'

let db: Database.Database

export function getDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getImagesDir(): string {
  const dir = join(getDataDir(), 'images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getDbPath(): string {
  return join(getDataDir(), 'tracker.db')
}

export function initDb(): void {
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_path TEXT,
      name TEXT NOT NULL,
      etsy_url TEXT,
      notes TEXT,
      decision TEXT,
      ai_summary TEXT,
      ai_summary_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      ads_views REAL,
      ads_clicks REAL,
      ads_orders REAL,
      ads_revenue REAL,
      ads_spend REAL,
      roas REAL,
      organic_visits REAL,
      organic_orders REAL,
      organic_revenue REAL,
      favorites REAL,
      original_images TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      raw_text TEXT,
      ai_summary TEXT,
      type TEXT,
      before TEXT,
      after TEXT,
      reason TEXT,
      review_date TEXT,
      effect TEXT,
      conclusion TEXT,
      images TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_snap_listing ON snapshots(listing_id, date);
    CREATE INDEX IF NOT EXISTS idx_action_listing ON actions(listing_id, date);
  `)

  migrate()
}

// 为每条记录补充跨设备唯一 ID（uid），用于导入/导出时按记录识别，不依赖本地自增 id
function migrate(): void {
  for (const t of ['listings', 'snapshots', 'actions']) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === 'uid')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN uid TEXT`)
    }
    const rows = db.prepare(`SELECT id FROM ${t} WHERE uid IS NULL OR uid = ''`).all() as {
      id: number
    }[]
    const upd = db.prepare(`UPDATE ${t} SET uid = ? WHERE id = ?`)
    const tx = db.transaction(() => {
      for (const r of rows) upd.run(randomUUID(), r.id)
    })
    tx()
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${t}_uid ON ${t}(uid)`)
  }
  // actions 增加配图列
  const acols = db.prepare('PRAGMA table_info(actions)').all() as { name: string }[]
  if (!acols.some((c) => c.name === 'images')) {
    db.exec('ALTER TABLE actions ADD COLUMN images TEXT')
  }
}

// ---------- Listings ----------

export function saveImage(dataUrl: string, prefix = 'img'): string {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  const ext = match ? match[1] : 'png'
  const base64 = match ? match[2] : dataUrl.replace(/^data:.*;base64,/, '')
  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const abs = join(getImagesDir(), filename)
  writeFileSync(abs, Buffer.from(base64, 'base64'))
  return filename // 只存相对文件名，读取时拼接 images 目录
}

export function listListings(): (Listing & {
  latest_snapshot: Snapshot | null
  last_action: Action | null
})[] {
  const rows = db.prepare('SELECT * FROM listings ORDER BY updated_at DESC').all() as Listing[]
  return rows.map((l) => ({
    ...l,
    latest_snapshot:
      (db
        .prepare('SELECT * FROM snapshots WHERE listing_id = ? ORDER BY date DESC, id DESC LIMIT 1')
        .get(l.id) as Snapshot) || null,
    last_action:
      (db
        .prepare('SELECT * FROM actions WHERE listing_id = ? ORDER BY date DESC, id DESC LIMIT 1')
        .get(l.id) as Action) || null
  }))
}

export function getListing(id: number): Listing | null {
  return (db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as Listing) || null
}

export function createListing(input: {
  name: string
  etsy_url: string | null
  notes: string | null
  image_path: string | null
}): Listing {
  const info = db
    .prepare('INSERT INTO listings (uid, name, etsy_url, notes, image_path) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), input.name, input.etsy_url, input.notes, input.image_path)
  return getListing(Number(info.lastInsertRowid))!
}

export function updateListing(id: number, patch: Partial<Listing>): Listing {
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length) {
    const set = fields.map((f) => `${f} = @${f}`).join(', ')
    db.prepare(`UPDATE listings SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({
      ...patch,
      id
    })
  }
  return getListing(id)!
}

export function deleteListing(id: number): void {
  db.prepare('DELETE FROM listings WHERE id = ?').run(id)
}

// ---------- Snapshots ----------

export function listSnapshots(listingId: number): Snapshot[] {
  return db
    .prepare('SELECT * FROM snapshots WHERE listing_id = ? ORDER BY date ASC, id ASC')
    .all(listingId) as Snapshot[]
}

export function createSnapshot(input: SnapshotInput): Snapshot {
  const info = db
    .prepare(
      `INSERT INTO snapshots
       (uid, listing_id, date, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas,
        organic_visits, organic_orders, organic_revenue, favorites, original_images, notes)
       VALUES (@uid, @listing_id, @date, @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend,
        @roas, @organic_visits, @organic_orders, @organic_revenue, @favorites, @original_images, @notes)`
    )
    .run({ ...input, uid: randomUUID() })
  db.prepare("UPDATE listings SET updated_at = datetime('now') WHERE id = ?").run(input.listing_id)
  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(info.lastInsertRowid) as Snapshot
}

export function deleteSnapshot(id: number): void {
  db.prepare('DELETE FROM snapshots WHERE id = ?').run(id)
}

// ---------- Actions ----------

export function listActions(listingId: number): Action[] {
  return db
    .prepare('SELECT * FROM actions WHERE listing_id = ? ORDER BY date ASC, id ASC')
    .all(listingId) as Action[]
}

export function createAction(input: ActionInput): Action {
  const info = db
    .prepare(
      `INSERT INTO actions
       (uid, listing_id, date, raw_text, ai_summary, type, before, after, reason, review_date, effect, conclusion, images)
       VALUES (@uid, @listing_id, @date, @raw_text, @ai_summary, @type, @before, @after, @reason, @review_date, @effect, @conclusion, @images)`
    )
    .run({ ...input, uid: randomUUID() })
  db.prepare("UPDATE listings SET updated_at = datetime('now') WHERE id = ?").run(input.listing_id)
  return db.prepare('SELECT * FROM actions WHERE id = ?').get(info.lastInsertRowid) as Action
}

export function updateAction(id: number, patch: Partial<Action>): Action {
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length) {
    const set = fields.map((f) => `${f} = @${f}`).join(', ')
    db.prepare(`UPDATE actions SET ${set} WHERE id = @id`).run({ ...patch, id })
  }
  return db.prepare('SELECT * FROM actions WHERE id = ?').get(id) as Action
}

export function deleteAction(id: number): void {
  db.prepare('DELETE FROM actions WHERE id = ?').run(id)
}

// ---------- 全量导出（备份用） ----------

export function exportAll(): {
  listings: Listing[]
  snapshots: Snapshot[]
  actions: Action[]
} {
  return {
    listings: db.prepare('SELECT * FROM listings').all() as Listing[],
    snapshots: db.prepare('SELECT * FROM snapshots').all() as Snapshot[],
    actions: db.prepare('SELECT * FROM actions').all() as Action[]
  }
}

type ImportData = {
  listings: (Listing & { uid?: string })[]
  snapshots: (Snapshot & { uid?: string })[]
  actions: (Action & { uid?: string })[]
}

function ensureUid<T extends { uid?: string }>(row: T): T & { uid: string } {
  return { ...row, uid: row.uid || randomUUID() }
}

// 覆盖式导入：清空本地，完全替换成文件内容
export function importAll(data: ImportData): void {
  const tx = db.transaction(() => {
    db.exec('DELETE FROM actions; DELETE FROM snapshots; DELETE FROM listings;')
    const li = db.prepare(
      `INSERT INTO listings (uid, id, image_path, name, etsy_url, notes, decision, ai_summary, ai_summary_at, created_at, updated_at)
       VALUES (@uid, @id, @image_path, @name, @etsy_url, @notes, @decision, @ai_summary, @ai_summary_at, @created_at, @updated_at)`
    )
    for (const l of data.listings) li.run(ensureUid(l))
    const si = db.prepare(
      `INSERT INTO snapshots (uid, id, listing_id, date, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas,
        organic_visits, organic_orders, organic_revenue, favorites, original_images, notes, created_at)
       VALUES (@uid, @id, @listing_id, @date, @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend, @roas,
        @organic_visits, @organic_orders, @organic_revenue, @favorites, @original_images, @notes, @created_at)`
    )
    for (const s of data.snapshots) si.run(ensureUid(s))
    const ai = db.prepare(
      `INSERT INTO actions (uid, id, listing_id, date, raw_text, ai_summary, type, before, after, reason, review_date, effect, conclusion, images, created_at)
       VALUES (@uid, @id, @listing_id, @date, @raw_text, @ai_summary, @type, @before, @after, @reason, @review_date, @effect, @conclusion, @images, @created_at)`
    )
    for (const a of data.actions) ai.run({ ...ensureUid(a), images: a.images ?? null })
  })
  tx()
}

// 合并式导入：按 uid 识别记录，只新增/更新，绝不删除本地独有数据。
// Listing 冲突用 updated_at 判断（谁更新用谁）；Snapshot/Action 以文件内容为准更新。
export function importMerge(data: ImportData): {
  listingsAdded: number
  listingsUpdated: number
  snapshots: number
  actions: number
} {
  const stat = { listingsAdded: 0, listingsUpdated: 0, snapshots: 0, actions: 0 }
  const tx = db.transaction(() => {
    // 1) listings：uid -> 本地 id 映射
    const impIdToUid = new Map<number, string>()
    const uidToLocalId = new Map<string, number>()

    const findLocal = db.prepare('SELECT id, updated_at FROM listings WHERE uid = ?')
    const updListing = db.prepare(
      `UPDATE listings SET name=@name, etsy_url=@etsy_url, notes=@notes, decision=@decision,
        ai_summary=@ai_summary, ai_summary_at=@ai_summary_at,
        image_path=COALESCE(@image_path, image_path), updated_at=@updated_at WHERE uid=@uid`
    )
    const insListing = db.prepare(
      `INSERT INTO listings (uid, image_path, name, etsy_url, notes, decision, ai_summary, ai_summary_at, created_at, updated_at)
       VALUES (@uid, @image_path, @name, @etsy_url, @notes, @decision, @ai_summary, @ai_summary_at, @created_at, @updated_at)`
    )
    for (const raw of data.listings) {
      const l = ensureUid(raw)
      impIdToUid.set(l.id, l.uid)
      const local = findLocal.get(l.uid) as { id: number; updated_at: string } | undefined
      if (local) {
        uidToLocalId.set(l.uid, local.id)
        if ((l.updated_at || '') > (local.updated_at || '')) {
          updListing.run(l)
          stat.listingsUpdated++
        }
      } else {
        const info = insListing.run(l)
        uidToLocalId.set(l.uid, Number(info.lastInsertRowid))
        stat.listingsAdded++
      }
    }

    // 2) snapshots：按 uid upsert，listing_id 重映射到本地 id
    const upSnap = db.prepare(
      `INSERT INTO snapshots (uid, listing_id, date, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas,
        organic_visits, organic_orders, organic_revenue, favorites, original_images, notes, created_at)
       VALUES (@uid, @listing_id, @date, @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend, @roas,
        @organic_visits, @organic_orders, @organic_revenue, @favorites, @original_images, @notes, @created_at)
       ON CONFLICT(uid) DO UPDATE SET listing_id=excluded.listing_id, date=excluded.date,
        ads_views=excluded.ads_views, ads_clicks=excluded.ads_clicks, ads_orders=excluded.ads_orders,
        ads_revenue=excluded.ads_revenue, ads_spend=excluded.ads_spend, roas=excluded.roas,
        organic_visits=excluded.organic_visits, organic_orders=excluded.organic_orders,
        organic_revenue=excluded.organic_revenue, favorites=excluded.favorites,
        original_images=excluded.original_images, notes=excluded.notes`
    )
    for (const raw of data.snapshots) {
      const s = ensureUid(raw)
      const localListingId = uidToLocalId.get(impIdToUid.get(s.listing_id) || '')
      if (!localListingId) continue
      upSnap.run({ ...s, listing_id: localListingId })
      stat.snapshots++
    }

    // 3) actions：同理
    const upAct = db.prepare(
      `INSERT INTO actions (uid, listing_id, date, raw_text, ai_summary, type, before, after, reason, review_date, effect, conclusion, images, created_at)
       VALUES (@uid, @listing_id, @date, @raw_text, @ai_summary, @type, @before, @after, @reason, @review_date, @effect, @conclusion, @images, @created_at)
       ON CONFLICT(uid) DO UPDATE SET listing_id=excluded.listing_id, date=excluded.date,
        raw_text=excluded.raw_text, ai_summary=excluded.ai_summary, type=excluded.type,
        before=excluded.before, after=excluded.after, reason=excluded.reason,
        review_date=excluded.review_date, effect=excluded.effect, conclusion=excluded.conclusion,
        images=excluded.images`
    )
    for (const raw of data.actions) {
      const a = ensureUid(raw)
      const localListingId = uidToLocalId.get(impIdToUid.get(a.listing_id) || '')
      if (!localListingId) continue
      upAct.run({ ...a, listing_id: localListingId, images: a.images ?? null })
      stat.actions++
    }
  })
  tx()
  return stat
}
