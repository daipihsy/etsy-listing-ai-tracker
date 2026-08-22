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

export type SnapshotInput = Omit<Snapshot, 'id' | 'created_at'>
export type ListingInput = Pick<Listing, 'name' | 'etsy_url' | 'notes'> & {
  imageDataUrl?: string | null // base64 data URL，主进程负责落盘
}
export type ActionInput = Omit<Action, 'id' | 'created_at'>
