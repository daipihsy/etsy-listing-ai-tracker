import type { Snapshot, Action } from '../../../shared/types'
import { ctr, cvr } from './format'

export interface BeforeAfter {
  before: Snapshot | null
  after: Snapshot | null
  rows: { label: string; before: string; after: string; delta: number | null }[]
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : (v * 100).toFixed(2) + '%'
}
function fmtNum(v: number | null, d = 0): string {
  return v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: d })
}
function fmtMoney(v: number | null): string {
  return v == null ? '—' : '$' + fmtNum(v, 2)
}

export function computeBeforeAfter(action: Action, snapshots: Snapshot[]): BeforeAfter {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1))
  const before = [...sorted].reverse().find((s) => s.date <= action.date) || null
  const after = sorted.find((s) => s.date > action.date) || null

  const orders = (s: Snapshot | null): number | null =>
    s ? (s.ads_orders ?? 0) + (s.organic_orders ?? 0) : null
  const revenue = (s: Snapshot | null): number | null =>
    s ? (s.ads_revenue ?? 0) + (s.organic_revenue ?? 0) : null

  const rows = [
    {
      label: 'CTR',
      before: fmtPct(ctr(before)),
      after: fmtPct(ctr(after)),
      delta: after && before ? (ctr(after) ?? 0) - (ctr(before) ?? 0) : null
    },
    {
      label: 'CVR',
      before: fmtPct(cvr(before)),
      after: fmtPct(cvr(after)),
      delta: after && before ? (cvr(after) ?? 0) - (cvr(before) ?? 0) : null
    },
    {
      label: 'Orders',
      before: fmtNum(orders(before)),
      after: fmtNum(orders(after)),
      delta: after && before ? (orders(after) ?? 0) - (orders(before) ?? 0) : null
    },
    {
      label: 'Revenue',
      before: fmtMoney(revenue(before)),
      after: fmtMoney(revenue(after)),
      delta: after && before ? (revenue(after) ?? 0) - (revenue(before) ?? 0) : null
    },
    {
      label: 'Ad Spend',
      before: fmtMoney(before?.ads_spend ?? null),
      after: fmtMoney(after?.ads_spend ?? null),
      delta: after && before ? (after.ads_spend ?? 0) - (before.ads_spend ?? 0) : null
    },
    {
      label: 'ROAS',
      before: fmtNum(before?.roas ?? null, 2),
      after: fmtNum(after?.roas ?? null, 2),
      delta: after && before ? (after.roas ?? 0) - (before.roas ?? 0) : null
    }
  ]
  return { before, after, rows }
}

export function buildSummaryContext(
  name: string,
  snapshots: Snapshot[],
  actions: Action[]
): string {
  const snapLines = snapshots
    .map(
      (s) =>
        `${s.date} | CTR ${fmtPct(ctr(s))} | CVR ${fmtPct(cvr(s))} | ROAS ${fmtNum(
          s.roas ?? null,
          2
        )} | Ad Spend ${fmtMoney(s.ads_spend ?? null)} | Orders ${fmtNum(
          (s.ads_orders ?? 0) + (s.organic_orders ?? 0)
        )} | Revenue ${fmtMoney((s.ads_revenue ?? 0) + (s.organic_revenue ?? 0))} | Favorites ${
          s.favorites ?? '—'
        }`
    )
    .join('\n')
  const actLines = actions
    .map(
      (a) =>
        `${a.date} | [${a.type}] ${a.ai_summary?.replace(/\n/g, ' ') || a.raw_text}${
          a.effect ? ` | 效果:${a.effect}` : ''
        }${a.conclusion ? ` | 结论:${a.conclusion}` : ''}`
    )
    .join('\n')
  return `Listing: ${name}

【Snapshot 历史】
${snapLines || '（无）'}

【运营动作】
${actLines || '（无）'}`
}
