import { parseLoose } from './format'
import type { TrafficSource, OrganicListingRow } from '../../../shared/types'

export interface StatsPageParsed {
  date_range: string
  visits: number | null
  orders: number | null
  conversion_rate: number | null
  revenue: number | null
  fav_items: number | null
  shop_follows: number | null
  reviews_count: number | null
  review_avg: number | null
  repeat_buyers: number | null
  cities_reached: number | null
  abandoned_carts: number | null
  traffic_sources: TrafficSource[]
  top_listings: OrganicListingRow[]
}

const TRAFFIC = [
  'Etsy app & other Etsy pages',
  'Etsy search',
  'Etsy marketing & SEO',
  'Direct & other traffic',
  'Social media',
  'Etsy Ads'
]
// 金额前缀：US$ / USD / $ / £ / € / 无
const CUR = '(?:US\\$|USD\\s+|[$£€])?'
// 自然 listing 行：views favorites orders revenue
const LROW = new RegExp(`^([\\d.,]+[KM]?)\\s+([\\d.,]+[KM]?)\\s+([\\d.,]+[KM]?)\\s+${CUR}([\\d.,]+[KM]?)$`, 'i')
// 日期区间：兼容日在前/月在前，可带年份
const DATE_RANGE =
  /(\d{1,2}\s+[A-Za-z]{3,}|[A-Za-z]{3,}\s+\d{1,2})(?:\s+\d{4})?\s*[-–]\s*(\d{1,2}\s+[A-Za-z]{3,}|[A-Za-z]{3,}\s+\d{1,2})(?:\s+\d{4})?/

// 解析 Etsy Stats / Shop stats 页「整页复制」文本（兼容多种店铺布局）
export function parseStatsPageText(text: string): StatsPageParsed {
  const L = text.split(/\r?\n/).map((l) => l.trim())
  const idxFrom = (label: string, from = 0): number => {
    for (let i = from; i < L.length; i++) if (L[i] === label) return i
    return -1
  }
  // 兼容英式/美式拼写：取第一个能找到的标签
  const firstIdx = (labels: string[]): number => {
    for (const lb of labels) {
      const i = idxFrom(lb)
      if (i >= 0) return i
    }
    return -1
  }
  // 取标签之后第一个「数字」值，跳过空行、同比(YoY)行、重复标签
  const valAfter = (idx: number): number | null => {
    if (idx < 0) return null
    for (let j = idx + 1; j < L.length; j++) {
      const l = L[j]
      if (!l || /YoY/i.test(l)) continue
      const n = parseLoose(l)
      if (n != null) return n
    }
    return null
  }

  const vi = idxFrom('Visits') // 店铺统计区的锚点（避开导航栏 Orders/Messages）
  const out: StatsPageParsed = {
    date_range: '',
    visits: valAfter(vi),
    orders: valAfter(idxFrom('Orders', vi + 1)),
    conversion_rate: valAfter(idxFrom('Conversion rate')),
    revenue: valAfter(idxFrom('Revenue', vi + 1)),
    fav_items: valAfter(firstIdx(['Item favorites', 'Item favourites'])),
    shop_follows: valAfter(idxFrom('Shop follows')),
    reviews_count: valAfter(idxFrom('Reviews')),
    review_avg: null,
    repeat_buyers: valAfter(idxFrom('Repeat buyers')),
    cities_reached: valAfter(idxFrom('Cities reached')),
    abandoned_carts: valAfter(firstIdx(['Abandoned carts', 'Abandoned baskets'])),
    traffic_sources: [],
    top_listings: []
  }

  const sm = text.match(/([\d.]+)\s*star average/i)
  out.review_avg = sm ? parseFloat(sm[1]) : null
  const dm = text.match(DATE_RANGE)
  out.date_range = dm ? dm[0].trim() : ''

  for (const name of TRAFFIC) {
    const i = idxFrom(name)
    if (i >= 0) out.traffic_sources.push({ name, visits: valAfter(i) })
  }

  let lastTitle = ''
  for (const line of L) {
    if (!line) continue
    const m = line.match(LROW)
    if (m && lastTitle) {
      out.top_listings.push({
        name: lastTitle,
        views: parseLoose(m[1]),
        favorites: parseLoose(m[2]),
        orders: parseLoose(m[3]),
        revenue: parseLoose(m[4])
      })
      continue
    }
    if (
      line === 'Active' ||
      line === 'Listing' ||
      /^(US\$|USD|\$|£|€)/.test(line) ||
      TRAFFIC.includes(line)
    )
      continue
    if (
      line.includes('|') ||
      (/[A-Za-z]/.test(line) && line.length > 8 && !/^[\d.,]+$/.test(line))
    )
      lastTitle = line.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  }

  return out
}
