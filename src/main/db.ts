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
  ActionInput,
  Shop,
  StoreSnapshot,
  StoreChat,
  StoreSnapshotInput
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

  // 整店分析相关表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      name TEXT NOT NULL,
      notes TEXT,
      ai_advice TEXT,
      ai_advice_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      shop_id INTEGER NOT NULL,
      date_range TEXT,
      visits REAL, orders REAL, conversion_rate REAL, revenue REAL,
      ads_views REAL, ads_clicks REAL, ads_orders REAL, ads_revenue REAL, ads_spend REAL, roas REAL, click_rate REAL,
      fav_items REAL, shop_follows REAL, reviews_count REAL, review_avg REAL, repeat_buyers REAL, cities_reached REAL, abandoned_carts REAL,
      daily_csv TEXT,
      ad_listings TEXT,
      stats_extra TEXT,
      original_images TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS store_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      shop_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ss_shop ON store_snapshots(shop_id);
    CREATE INDEX IF NOT EXISTS idx_sc_shop ON store_chats(shop_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_uid ON shops(uid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ss_uid ON store_snapshots(uid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_uid ON store_chats(uid);
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
  // store_snapshots 增加单链接广告明细列
  const sscols = db.prepare('PRAGMA table_info(store_snapshots)').all() as { name: string }[]
  if (sscols.length && !sscols.some((c) => c.name === 'ad_listings')) {
    db.exec('ALTER TABLE store_snapshots ADD COLUMN ad_listings TEXT')
  }
  if (sscols.length && !sscols.some((c) => c.name === 'stats_extra')) {
    db.exec('ALTER TABLE store_snapshots ADD COLUMN stats_extra TEXT')
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

// ---------- Shops（整店） ----------

export function listShops(): (Shop & { latest: StoreSnapshot | null })[] {
  const rows = db.prepare('SELECT * FROM shops ORDER BY updated_at DESC').all() as Shop[]
  return rows.map((s) => ({
    ...s,
    latest:
      (db
        .prepare('SELECT * FROM store_snapshots WHERE shop_id = ? ORDER BY id DESC LIMIT 1')
        .get(s.id) as StoreSnapshot) || null
  }))
}

export function getShop(id: number): Shop | null {
  return (db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as Shop) || null
}

export function createShop(input: { name: string; notes: string | null }): Shop {
  const info = db
    .prepare('INSERT INTO shops (uid, name, notes) VALUES (?, ?, ?)')
    .run(randomUUID(), input.name, input.notes)
  return getShop(Number(info.lastInsertRowid))!
}

export function updateShop(id: number, patch: Partial<Shop>): Shop {
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length) {
    const set = fields.map((f) => `${f} = @${f}`).join(', ')
    db.prepare(`UPDATE shops SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({
      ...patch,
      id
    })
  }
  return getShop(id)!
}

export function deleteShop(id: number): void {
  db.prepare('DELETE FROM shops WHERE id = ?').run(id)
}

// ---------- Store Snapshots ----------

export function listStoreSnapshots(shopId: number): StoreSnapshot[] {
  return db
    .prepare('SELECT * FROM store_snapshots WHERE shop_id = ? ORDER BY id ASC')
    .all(shopId) as StoreSnapshot[]
}

export function createStoreSnapshot(input: StoreSnapshotInput): StoreSnapshot {
  const info = db
    .prepare(
      `INSERT INTO store_snapshots
       (uid, shop_id, date_range, visits, orders, conversion_rate, revenue,
        ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas, click_rate,
        fav_items, shop_follows, reviews_count, review_avg, repeat_buyers, cities_reached, abandoned_carts,
        daily_csv, ad_listings, stats_extra, original_images, notes)
       VALUES (@uid, @shop_id, @date_range, @visits, @orders, @conversion_rate, @revenue,
        @ads_views, @ads_clicks, @ads_orders, @ads_revenue, @ads_spend, @roas, @click_rate,
        @fav_items, @shop_follows, @reviews_count, @review_avg, @repeat_buyers, @cities_reached, @abandoned_carts,
        @daily_csv, @ad_listings, @stats_extra, @original_images, @notes)`
    )
    .run({ ...input, uid: randomUUID() })
  db.prepare("UPDATE shops SET updated_at = datetime('now') WHERE id = ?").run(input.shop_id)
  return db
    .prepare('SELECT * FROM store_snapshots WHERE id = ?')
    .get(info.lastInsertRowid) as StoreSnapshot
}

export function deleteStoreSnapshot(id: number): void {
  db.prepare('DELETE FROM store_snapshots WHERE id = ?').run(id)
}

// ---------- Store Chats ----------

export function listStoreChats(shopId: number): StoreChat[] {
  return db
    .prepare('SELECT * FROM store_chats WHERE shop_id = ? ORDER BY id ASC')
    .all(shopId) as StoreChat[]
}

export function addStoreChat(shopId: number, role: 'user' | 'assistant', content: string): StoreChat {
  const info = db
    .prepare('INSERT INTO store_chats (uid, shop_id, role, content) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), shopId, role, content)
  return db.prepare('SELECT * FROM store_chats WHERE id = ?').get(info.lastInsertRowid) as StoreChat
}

export function clearStoreChats(shopId: number): void {
  db.prepare('DELETE FROM store_chats WHERE shop_id = ?').run(shopId)
}

// ---------- 全量导出（备份用） ----------

export function exportAll(): {
  listings: Listing[]
  snapshots: Snapshot[]
  actions: Action[]
  shops: Shop[]
  storeSnapshots: StoreSnapshot[]
  storeChats: StoreChat[]
} {
  return {
    listings: db.prepare('SELECT * FROM listings').all() as Listing[],
    snapshots: db.prepare('SELECT * FROM snapshots').all() as Snapshot[],
    actions: db.prepare('SELECT * FROM actions').all() as Action[],
    shops: db.prepare('SELECT * FROM shops').all() as Shop[],
    storeSnapshots: db.prepare('SELECT * FROM store_snapshots').all() as StoreSnapshot[],
    storeChats: db.prepare('SELECT * FROM store_chats').all() as StoreChat[]
  }
}

type ImportData = {
  listings: (Listing & { uid?: string })[]
  snapshots: (Snapshot & { uid?: string })[]
  actions: (Action & { uid?: string })[]
  shops?: (Shop & { uid?: string })[]
  storeSnapshots?: (StoreSnapshot & { uid?: string })[]
  storeChats?: (StoreChat & { uid?: string })[]
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

    db.exec('DELETE FROM store_chats; DELETE FROM store_snapshots; DELETE FROM shops;')
    const sh = db.prepare(
      `INSERT INTO shops (uid, id, name, notes, ai_advice, ai_advice_at, created_at, updated_at)
       VALUES (@uid, @id, @name, @notes, @ai_advice, @ai_advice_at, @created_at, @updated_at)`
    )
    for (const s of data.shops || []) sh.run(ensureUid(s))
    const ssi = db.prepare(storeSnapInsertSql('id'))
    for (const s of data.storeSnapshots || []) ssi.run(ensureUid(s))
    const sci = db.prepare(
      `INSERT INTO store_chats (uid, id, shop_id, role, content, created_at)
       VALUES (@uid, @id, @shop_id, @role, @content, @created_at)`
    )
    for (const c of data.storeChats || []) sci.run(ensureUid(c))
  })
  tx()
}

function storeSnapInsertSql(includeId: 'id' | 'noid'): string {
  const cols =
    'uid, shop_id, date_range, visits, orders, conversion_rate, revenue, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas, click_rate, fav_items, shop_follows, reviews_count, review_avg, repeat_buyers, cities_reached, abandoned_carts, daily_csv, ad_listings, stats_extra, original_images, notes, created_at'
  const withId = includeId === 'id' ? 'id, ' + cols : cols
  const vals = withId
    .split(', ')
    .map((c) => '@' + c)
    .join(', ')
  return `INSERT INTO store_snapshots (${withId}) VALUES (${vals})`
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

    // 4) shops：uid -> 本地 id
    const shopUidToLocal = new Map<string, number>()
    const shopImpIdToUid = new Map<number, string>()
    const findShop = db.prepare('SELECT id, updated_at FROM shops WHERE uid = ?')
    const updShop = db.prepare(
      `UPDATE shops SET name=@name, notes=@notes, ai_advice=@ai_advice, ai_advice_at=@ai_advice_at, updated_at=@updated_at WHERE uid=@uid`
    )
    const insShop = db.prepare(
      `INSERT INTO shops (uid, name, notes, ai_advice, ai_advice_at, created_at, updated_at)
       VALUES (@uid, @name, @notes, @ai_advice, @ai_advice_at, @created_at, @updated_at)`
    )
    for (const raw of data.shops || []) {
      const s = ensureUid(raw)
      shopImpIdToUid.set(s.id, s.uid)
      const local = findShop.get(s.uid) as { id: number; updated_at: string } | undefined
      if (local) {
        shopUidToLocal.set(s.uid, local.id)
        if ((s.updated_at || '') > (local.updated_at || '')) updShop.run(s)
      } else {
        const info = insShop.run(s)
        shopUidToLocal.set(s.uid, Number(info.lastInsertRowid))
      }
    }

    // 5) store_snapshots：按 uid upsert，shop_id 重映射
    const cols =
      'shop_id, date_range, visits, orders, conversion_rate, revenue, ads_views, ads_clicks, ads_orders, ads_revenue, ads_spend, roas, click_rate, fav_items, shop_follows, reviews_count, review_avg, repeat_buyers, cities_reached, abandoned_carts, daily_csv, ad_listings, stats_extra, original_images, notes, created_at'
    const setClause = cols
      .split(', ')
      .map((c) => `${c}=excluded.${c}`)
      .join(', ')
    const upStoreSnap = db.prepare(
      `INSERT INTO store_snapshots (uid, ${cols}) VALUES (@uid, ${cols
        .split(', ')
        .map((c) => '@' + c)
        .join(', ')})
       ON CONFLICT(uid) DO UPDATE SET ${setClause}`
    )
    for (const raw of data.storeSnapshots || []) {
      const s = ensureUid(raw)
      const localShopId = shopUidToLocal.get(shopImpIdToUid.get(s.shop_id) || '')
      if (!localShopId) continue
      upStoreSnap.run({ ...s, shop_id: localShopId })
    }

    // 6) store_chats：按 uid upsert，shop_id 重映射
    const upChat = db.prepare(
      `INSERT INTO store_chats (uid, shop_id, role, content, created_at)
       VALUES (@uid, @shop_id, @role, @content, @created_at)
       ON CONFLICT(uid) DO UPDATE SET shop_id=excluded.shop_id, role=excluded.role, content=excluded.content`
    )
    for (const raw of data.storeChats || []) {
      const c = ensureUid(raw)
      const localShopId = shopUidToLocal.get(shopImpIdToUid.get(c.shop_id) || '')
      if (!localShopId) continue
      upChat.run({ ...c, shop_id: localShopId })
    }
  })
  tx()
  return stat
}
