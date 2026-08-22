import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_snap_listing ON snapshots(listing_id, date);
    CREATE INDEX IF NOT EXISTS idx_action_listing ON actions(listing_id, date);
  `)
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
    .prepare('INSERT INTO listings (name, etsy_url, notes, image_path) VALUES (?, ?, ?, ?)')
    .run(input.name, input.etsy_url, input.notes, input.image_path)
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
       (listing_id, date, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas,
        organic_visits, organic_orders, organic_revenue, favorites, original_images, notes)
       VALUES (@listing_id, @date, @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend,
        @roas, @organic_visits, @organic_orders, @organic_revenue, @favorites, @original_images, @notes)`
    )
    .run(input)
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
       (listing_id, date, raw_text, ai_summary, type, before, after, reason, review_date, effect, conclusion)
       VALUES (@listing_id, @date, @raw_text, @ai_summary, @type, @before, @after, @reason, @review_date, @effect, @conclusion)`
    )
    .run(input)
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

export function importAll(data: {
  listings: Listing[]
  snapshots: Snapshot[]
  actions: Action[]
}): void {
  const tx = db.transaction(() => {
    db.exec('DELETE FROM actions; DELETE FROM snapshots; DELETE FROM listings;')
    const li = db.prepare(
      `INSERT INTO listings (id, image_path, name, etsy_url, notes, decision, ai_summary, ai_summary_at, created_at, updated_at)
       VALUES (@id, @image_path, @name, @etsy_url, @notes, @decision, @ai_summary, @ai_summary_at, @created_at, @updated_at)`
    )
    for (const l of data.listings) li.run(l)
    const si = db.prepare(
      `INSERT INTO snapshots (id, listing_id, date, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas,
        organic_visits, organic_orders, organic_revenue, favorites, original_images, notes, created_at)
       VALUES (@id, @listing_id, @date, @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend, @roas,
        @organic_visits, @organic_orders, @organic_revenue, @favorites, @original_images, @notes, @created_at)`
    )
    for (const s of data.snapshots) si.run(s)
    const ai = db.prepare(
      `INSERT INTO actions (id, listing_id, date, raw_text, ai_summary, type, before, after, reason, review_date, effect, conclusion, created_at)
       VALUES (@id, @listing_id, @date, @raw_text, @ai_summary, @type, @before, @after, @reason, @review_date, @effect, @conclusion, @created_at)`
    )
    for (const a of data.actions) ai.run(a)
  })
  tx()
}
