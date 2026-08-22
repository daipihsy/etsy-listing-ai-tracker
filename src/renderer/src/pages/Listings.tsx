import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingUp } from 'lucide-react'
import { StoredImage } from '../components/StoredImage'
import { Button } from '../components/ui'
import { NewListingModal } from '../components/NewListingModal'
import { ctr, cvr, money, num, pct, totalOrders, totalRevenue } from '../lib/format'
import type { Listing, Snapshot, Action } from '../../../shared/types'

type Row = Listing & { latest_snapshot: Snapshot | null; last_action: Action | null }

export function Listings(): JSX.Element {
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    setRows(await window.api.listings.list())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-4">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Listings</h1>
          <p className="text-sm text-black/40">{rows.length} 个产品 · 点击卡片查看趋势与复盘</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> 新建 Listing
        </Button>
      </header>

      {loading ? (
        <p className="py-20 text-center text-black/40">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 py-20 text-center">
          <p className="text-black/50">还没有 Listing。</p>
          <p className="mt-1 text-sm text-black/30">点击右上角「新建 Listing」，粘贴主图开始记录。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} row={r} onClick={() => nav(`/listings/${r.id}`)} />
          ))}
        </div>
      )}

      {showNew && <NewListingModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  )
}

function Card({ row, onClick }: { row: Row; onClick: () => void }): JSX.Element {
  const s = row.latest_snapshot
  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm transition hover:shadow-md"
    >
      <StoredImage filename={row.image_path} className="h-40 w-full object-cover" />
      <div className="p-4">
        <p className="truncate font-semibold">{row.name}</p>
        <div className="mt-3 grid grid-cols-3 gap-y-2 text-sm">
          <Metric label="CTR" value={pct(ctr(s))} />
          <Metric label="CVR" value={pct(cvr(s))} />
          <Metric label="ROAS" value={s?.roas != null ? num(s.roas, 2) : '—'} />
          <Metric label="Orders" value={num(totalOrders(s))} />
          <Metric label="Revenue" value={money(totalRevenue(s))} span={2} />
        </div>
        <div className="mt-3 border-t border-black/5 pt-2.5">
          {row.last_action ? (
            <p className="flex items-center gap-1.5 text-xs text-black/50">
              <TrendingUp size={13} className="text-etsy" />
              <span className="truncate">
                {row.last_action.ai_summary?.split('\n')[0] || row.last_action.raw_text}
              </span>
            </p>
          ) : (
            <p className="text-xs text-black/30">暂无运营动作</p>
          )}
          <p className="mt-1 text-[11px] text-black/30">
            {s ? `最新数据 ${s.date}` : '暂无数据'} · 更新 {row.updated_at.slice(0, 10)}
          </p>
        </div>
      </div>
    </button>
  )
}

function Metric({
  label,
  value,
  span
}: {
  label: string
  value: string
  span?: number
}): JSX.Element {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <p className="text-[11px] uppercase tracking-wide text-black/35">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}
