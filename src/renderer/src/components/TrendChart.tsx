import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot
} from 'recharts'
import type { Snapshot, Action } from '../../../shared/types'
import { ctr, cvr } from '../lib/format'

type MetricKey = 'ctr' | 'cvr' | 'orders' | 'revenue' | 'roas' | 'spend'

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'ctr', label: 'CTR', fmt: (v) => (v * 100).toFixed(2) + '%' },
  { key: 'cvr', label: 'CVR', fmt: (v) => (v * 100).toFixed(2) + '%' },
  { key: 'orders', label: 'Orders', fmt: (v) => String(Math.round(v)) },
  { key: 'revenue', label: 'Revenue', fmt: (v) => '$' + v.toFixed(0) },
  { key: 'roas', label: 'ROAS', fmt: (v) => v.toFixed(2) },
  { key: 'spend', label: 'Ad Spend', fmt: (v) => '$' + v.toFixed(0) }
]

function valueOf(s: Snapshot, key: MetricKey): number | null {
  switch (key) {
    case 'ctr':
      return ctr(s)
    case 'cvr':
      return cvr(s)
    case 'orders':
      return (s.ads_orders ?? 0) + (s.organic_orders ?? 0)
    case 'revenue':
      return (s.ads_revenue ?? 0) + (s.organic_revenue ?? 0)
    case 'roas':
      return s.roas
    case 'spend':
      return s.ads_spend
  }
}

export function TrendChart({
  snapshots,
  actions
}: {
  snapshots: Snapshot[]
  actions: Action[]
}): JSX.Element {
  const [metric, setMetric] = useState<MetricKey>('roas')
  const active = METRICS.find((m) => m.key === metric)!

  const data = snapshots.map((s) => ({
    date: s.date,
    value: valueOf(s, metric)
  }))

  // 在图上标出有运营动作的日期
  const actionDates = new Set(actions.map((a) => a.date))
  const marks = data.filter((d) => actionDates.has(d.date) && d.value != null)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={
              'rounded-full px-3 py-1 text-xs font-medium transition ' +
              (metric === m.key ? 'bg-etsy text-white' : 'bg-black/5 text-black/55 hover:bg-black/10')
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-black/30">暂无数据，先添加 Snapshot。</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#00000040" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#00000040"
              width={54}
              tickFormatter={(v) => active.fmt(v)}
            />
            <Tooltip
              formatter={(v: number) => [active.fmt(v), active.label]}
              contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #eee' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#F1641E"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            {marks.map((m, i) => (
              <ReferenceDot
                key={i}
                x={m.date}
                y={m.value as number}
                r={5}
                fill="#111"
                stroke="#fff"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-1 text-[11px] text-black/30">● 黑点标记当天有运营动作</p>
    </div>
  )
}
