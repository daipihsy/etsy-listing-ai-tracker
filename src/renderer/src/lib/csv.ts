import { parseLoose } from './format'

export interface DailyRow {
  date: string
  views: number | null
  clicks: number | null
  orders: number | null
  revenue: number | null
  spend: number | null
  roas: number | null
  click_rate: number | null
}

export interface CsvParsed {
  rows: DailyRow[]
  totals: {
    views: number
    clicks: number
    orders: number
    revenue: number
    spend: number
    roas: number | null
    click_rate: number | null
    dateStart: string
    dateEnd: string
  }
}

// 解析一行 CSV（处理引号）
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// 解析 Etsy Ads 每日 CSV（列名匹配，容错大小写/后缀）
export function parseAdsCsv(text: string): CsvParsed {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV 内容为空或没有数据行')
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())

  const idx = (kw: string): number => header.findIndex((h) => h.includes(kw))
  const iDate = idx('date')
  const iViews = idx('view')
  const iClicks = header.findIndex((h) => h.includes('click') && !h.includes('rate'))
  const iOrders = idx('order')
  const iRevenue = idx('revenue')
  const iSpend = idx('spend')
  const iRoas = idx('roas')
  const iRate = header.findIndex((h) => h.includes('click rate') || h.includes('ctr'))

  const rows: DailyRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i])
    if (c.length < 2) continue
    rows.push({
      date: (c[iDate] || '').replace(/"/g, '').trim(),
      views: iViews >= 0 ? parseLoose(c[iViews]) : null,
      clicks: iClicks >= 0 ? parseLoose(c[iClicks]) : null,
      orders: iOrders >= 0 ? parseLoose(c[iOrders]) : null,
      revenue: iRevenue >= 0 ? parseLoose(c[iRevenue]) : null,
      spend: iSpend >= 0 ? parseLoose(c[iSpend]) : null,
      roas: iRoas >= 0 ? parseLoose(c[iRoas]) : null,
      click_rate: iRate >= 0 ? parseLoose(c[iRate]) : null
    })
  }

  const sum = (k: keyof DailyRow): number =>
    rows.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
  const views = sum('views')
  const clicks = sum('clicks')
  const spend = sum('spend')
  const revenue = sum('revenue')

  return {
    rows,
    totals: {
      views,
      clicks,
      orders: sum('orders'),
      revenue,
      spend,
      roas: spend > 0 ? +(revenue / spend).toFixed(2) : null,
      click_rate: views > 0 ? +((clicks / views) * 100).toFixed(2) : null,
      dateStart: rows[0]?.date || '',
      dateEnd: rows[rows.length - 1]?.date || ''
    }
  }
}
