import type { Snapshot } from '../../../shared/types'

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return '$' + num(v, 2)
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return (v * 100).toFixed(2) + '%'
}

// CTR = clicks / views
export function ctr(s: Snapshot | null): number | null {
  if (!s || !s.ads_views || !s.ads_clicks) return null
  return s.ads_clicks / s.ads_views
}

// CVR = ads orders / clicks
export function cvr(s: Snapshot | null): number | null {
  if (!s || !s.ads_clicks || s.ads_orders === null) return null
  return (s.ads_orders || 0) / s.ads_clicks
}

export function totalOrders(s: Snapshot | null): number | null {
  if (!s) return null
  const a = s.ads_orders ?? 0
  const o = s.organic_orders ?? 0
  if (s.ads_orders === null && s.organic_orders === null) return null
  return a + o
}

export function totalRevenue(s: Snapshot | null): number | null {
  if (!s) return null
  if (s.ads_revenue === null && s.organic_revenue === null) return null
  return (s.ads_revenue ?? 0) + (s.organic_revenue ?? 0)
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

// 把 "378.7K" / "21,454.16" / "$3.2%" 等清洗成 number
export function parseLoose(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') return input
  // 去掉货币代码/符号、千分位、百分号、空格（如 "USD 31,933.68" / "$3.4%"）
  let s = String(input)
    .trim()
    .replace(/us\$|usd|eur|gbp|cad|aud/gi, '')
    .replace(/[$£€,%\s]/g, '')
  let mult = 1
  if (/k$/i.test(s)) {
    mult = 1_000
    s = s.replace(/k$/i, '')
  } else if (/m$/i.test(s)) {
    mult = 1_000_000
    s = s.replace(/m$/i, '')
  }
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n * mult
}
