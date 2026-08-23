import { parseLoose } from './format'
import type { AdListingRow } from '../../../shared/types'

export interface AdsPageParsed {
  totals: {
    views: number | null
    clicks: number | null
    orders: number | null
    revenue: number | null
    spend: number | null
    roas: number | null
    click_rate: number | null
  }
  date_range: string
  listings: AdListingRow[]
}

const STRATEGIES = ['Efficient spending', 'Greater visibility', 'Lower click cost']
const SKIP = new Set(['.', 'Advertising status', 'Advertised', 'Ad on/off', ...STRATEGIES])
const AGG: Record<string, keyof AdsPageParsed['totals']> = {
  Views: 'views',
  Clicks: 'clicks',
  Orders: 'orders',
  Revenue: 'revenue',
  Spend: 'spend',
  ROAS: 'roas'
}
// 金额前缀：US$ / USD / $ / £ / € / 无
const CUR = '(?:US\\$|USD\\s+|[$£€])?'
// 日期区间：兼容「日在前(25 Jul - 23 Aug)」和「月在前(Jul 24 - Aug 22)」，可带年份
const DATE_RANGE =
  /(\d{1,2}\s+[A-Za-z]{3,}|[A-Za-z]{3,}\s+\d{1,2})(?:\s+\d{4})?\s*[-–]\s*(\d{1,2}\s+[A-Za-z]{3,}|[A-Za-z]{3,}\s+\d{1,2})(?:\s+\d{4})?/
// 一行数据：views clicks click_rate% orders revenue spend roas
const ROW = new RegExp(
  `^([\\d.,]+[KM]?)\\s+([\\d.,]+)\\s+([\\d.]+%)\\s+(\\d+)\\s+${CUR}([\\d.,]+[KM]?)\\s+${CUR}([\\d.,]+[KM]?)\\s+([\\d.]+)$`,
  'i'
)

// 从 Etsy Ads 页面「整页复制」的纯文本里解析整店汇总 + 各单链接明细
export function parseAdsPageText(text: string): AdsPageParsed {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const nonEmptyAfter = (i: number): string => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j]) return lines[j]
    return ''
  }

  const totals: AdsPageParsed['totals'] = {
    views: null,
    clicks: null,
    orders: null,
    revenue: null,
    spend: null,
    roas: null,
    click_rate: null
  }
  for (let i = 0; i < lines.length; i++) {
    const key = AGG[lines[i]]
    if (key && totals[key] == null) {
      const v = parseLoose(nonEmptyAfter(i))
      if (v != null) totals[key] = v
    }
  }

  let date_range = ''
  const dm = text.match(DATE_RANGE)
  if (dm) date_range = dm[0].trim()

  const listings: AdListingRow[] = []
  let lastTitle = ''
  let lastStrategy: string | null = null
  for (const line of lines) {
    if (!line) continue
    const m = line.match(ROW)
    if (m) {
      if (lastTitle) {
        listings.push({
          name: lastTitle,
          strategy: lastStrategy,
          views: parseLoose(m[1]),
          clicks: parseLoose(m[2]),
          click_rate: parseLoose(m[3]),
          orders: parseLoose(m[4]),
          revenue: parseLoose(m[5]),
          spend: parseLoose(m[6]),
          roas: parseLoose(m[7])
        })
      }
      lastStrategy = null
      continue
    }
    if (STRATEGIES.includes(line)) {
      lastStrategy = line
      continue
    }
    if (SKIP.has(line)) continue
    const isTitle =
      line.includes('|') ||
      (/[A-Za-z]/.test(line) &&
        line.length > 6 &&
        !AGG[line] &&
        !/^(US\$|USD|\$|£|€)/.test(line) &&
        !['Listing', 'Click rate', 'Strategy'].includes(line))
    if (isTitle) lastTitle = line.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  }

  if (totals.click_rate == null && totals.clicks != null && totals.views)
    totals.click_rate = +((totals.clicks / totals.views) * 100).toFixed(2)

  return { totals, date_range, listings }
}
