// 全应用共享的数据模型类型定义

export interface Listing {
  id: number
  image_path: string | null
  name: string
  etsy_url: string | null
  notes: string | null
  decision: string | null // 用户判断：继续投入 / 保持 / 停止关注 / 测试其他方案
  ai_summary: string | null
  ai_summary_at: string | null
  created_at: string
  updated_at: string
}

export interface Snapshot {
  id: number
  listing_id: number
  date: string // YYYY-MM-DD
  // 广告数据 (Etsy Ads)
  ads_views: number | null
  ads_clicks: number | null
  ads_orders: number | null
  ads_revenue: number | null
  ads_spend: number | null
  roas: number | null
  // 自然数据 (Listing Stats)
  organic_visits: number | null
  organic_orders: number | null
  organic_revenue: number | null
  // 可选
  favorites: number | null
  original_images: string | null // JSON 数组：保存的原始截图路径
  notes: string | null
  created_at: string
}

export type ActionType = 'Price' | 'Ads' | 'Image' | 'Title' | 'Variation' | 'Other'
export type ActionEffect = 'Effective' | 'Neutral' | 'Ineffective' | null

export interface Action {
  id: number
  listing_id: number
  date: string
  raw_text: string
  ai_summary: string | null
  type: ActionType
  before: string | null
  after: string | null
  reason: string | null
  review_date: string | null
  effect: ActionEffect
  conclusion: string | null // My Conclusion
  images: string | null // JSON 数组：配图文件名（如换主图前后对比）
  created_at: string
}

// AI 识别广告截图返回
export interface AdsExtract {
  date_range?: string | null
  views?: number | null
  clicks?: number | null
  orders?: number | null
  revenue?: number | null
  spend?: number | null
  roas?: number | null
}

// AI 识别自然流量截图返回
export interface OrganicExtract {
  visits?: number | null
  items_sold?: number | null
  revenue?: number | null
}

export interface FavoritesExtract {
  favorites?: number | null
}

// 从「粘贴的页面文本」里提取单个 listing 的一期数据（广告 + 自然 + 收藏）
export interface SnapshotTextExtract {
  date_range?: string | null
  views?: number | null // 广告 Views
  clicks?: number | null
  orders?: number | null // 广告 Orders
  revenue?: number | null // 广告 Revenue
  spend?: number | null
  roas?: number | null
  visits?: number | null // 自然 Visits
  items_sold?: number | null // 自然 Orders
  organic_revenue?: number | null // 自然 Revenue
  favorites?: number | null
}

// AI 整理运营动作返回
export interface ActionSummary {
  type: ActionType
  action: string // 动作标题
  details: string
  before?: string | null
  after?: string | null
  reason: string
  review_days?: number | null
}

export interface AiSettings {
  baseUrl: string
  apiKey: string
  model: string
  visionModel: string
}

// ---------------- 整店分析 ----------------

export interface Shop {
  id: number
  uid: string
  name: string
  notes: string | null
  ai_advice: string | null
  ai_advice_at: string | null
  created_at: string
  updated_at: string
}

export interface StoreSnapshot {
  id: number
  uid: string
  shop_id: number
  date_range: string // 如 "Jul 24 - Aug 22"
  // 整店流量
  visits: number | null
  orders: number | null
  conversion_rate: number | null // 百分数值，如 3.4
  revenue: number | null
  // 整店广告
  ads_views: number | null
  ads_clicks: number | null
  ads_orders: number | null
  ads_revenue: number | null
  ads_spend: number | null
  roas: number | null
  click_rate: number | null // 百分数值
  // Shopper Stats
  fav_items: number | null
  shop_follows: number | null
  reviews_count: number | null
  review_avg: number | null
  repeat_buyers: number | null
  cities_reached: number | null
  abandoned_carts: number | null
  // 附加
  daily_csv: string | null // JSON：每日广告序列，用于趋势图
  ad_listings: string | null // JSON：AdListingRow[]，广告页里各单链接的明细
  stats_extra: string | null // JSON：StatsExtra，流量来源 + 自然 top listings
  original_images: string | null // JSON：原始截图文件名
  notes: string | null
  created_at: string
}

export interface TrafficSource {
  name: string
  visits?: number | null
}

export interface OrganicListingRow {
  name: string
  views?: number | null
  favorites?: number | null
  orders?: number | null
  revenue?: number | null
}

export interface StatsExtra {
  traffic_sources: TrafficSource[]
  top_listings: OrganicListingRow[]
}

// 广告页里单个 listing 的一行数据
export interface AdListingRow {
  name: string
  strategy?: string | null // Efficient spending / Greater visibility / Lower click cost
  views?: number | null
  clicks?: number | null
  click_rate?: number | null
  orders?: number | null
  revenue?: number | null
  spend?: number | null
  roas?: number | null
}

export interface StoreChat {
  id: number
  uid: string
  shop_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface StoreStatsExtract {
  date_range?: string | null
  visits?: number | null
  orders?: number | null
  conversion_rate?: number | null
  revenue?: number | null
  fav_items?: number | null
  shop_follows?: number | null
  reviews_count?: number | null
  review_avg?: number | null
  repeat_buyers?: number | null
  cities_reached?: number | null
  abandoned_carts?: number | null
}

export interface StoreAdsExtract {
  date_range?: string | null
  views?: number | null
  clicks?: number | null
  orders?: number | null
  revenue?: number | null
  spend?: number | null
  roas?: number | null
  click_rate?: number | null
  listings?: AdListingRow[] // 广告页里各单链接明细
}

export type ShopInput = Pick<Shop, 'name' | 'notes'>
export type StoreSnapshotInput = Omit<StoreSnapshot, 'id' | 'uid' | 'created_at'>
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GithubConfig {
  clientId: string
  token: string
  user: string
  repo: string
  lastSync: string
  remoteVersion: string // 本设备上次同步时云端数据的版本标识（用于判断该推还是该拉）
}

export interface GithubStatus {
  loggedIn: boolean
  clientId: string
  user: string
  repo: string
  lastSync: string
}

export interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface SyncResult {
  mode: 'pushed' | 'pulled'
  listings: number
  snapshots: number
  actions: number
  shops: number
  storeSnapshots: number
  imagesPulled: number
  imagesPushed: number
}

export type SnapshotInput = Omit<Snapshot, 'id' | 'created_at'>
export type ListingInput = Pick<Listing, 'name' | 'etsy_url' | 'notes'> & {
  imageDataUrl?: string | null // base64 data URL，主进程负责落盘
}
export type ActionInput = Omit<Action, 'id' | 'created_at'>
