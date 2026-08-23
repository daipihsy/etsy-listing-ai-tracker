import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Store as StoreIcon } from 'lucide-react'
import { Button } from '../components/ui'
import { NewShopModal } from '../components/NewShopModal'
import { money, num } from '../lib/format'
import type { Shop, StoreSnapshot } from '../../../shared/types'

type Row = Shop & { latest: StoreSnapshot | null }

export function Stores(): JSX.Element {
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    setRows(await window.api.shops.list())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-4">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">整店分析</h1>
          <p className="text-sm text-black/40">{rows.length} 家店 · 整店数据记录、AI 优化建议与对话</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> 新建店铺
        </Button>
      </header>

      {loading ? (
        <p className="py-20 text-center text-black/40">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 py-20 text-center">
          <StoreIcon className="mx-auto mb-2 text-black/20" size={30} />
          <p className="text-black/50">还没有店铺。</p>
          <p className="mt-1 text-sm text-black/30">点右上角「新建店铺」，之后可粘贴整店截图或导入 CSV。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => nav(`/stores/${r.id}`)}
              className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <StoreIcon size={16} className="text-etsy" />
                <p className="truncate font-semibold">{r.name}</p>
              </div>
              {r.latest ? (
                <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                  <Metric label="营收" value={money(r.latest.revenue)} />
                  <Metric label="订单" value={num(r.latest.orders)} />
                  <Metric
                    label="转化率"
                    value={r.latest.conversion_rate != null ? r.latest.conversion_rate + '%' : '—'}
                  />
                  <Metric label="广告 ROAS" value={r.latest.roas != null ? num(r.latest.roas, 2) : '—'} />
                </div>
              ) : (
                <p className="mt-3 text-xs text-black/30">暂无数据</p>
              )}
              <p className="mt-3 border-t border-black/5 pt-2 text-[11px] text-black/30">
                {r.latest?.date_range ? `周期 ${r.latest.date_range} · ` : ''}更新{' '}
                {r.updated_at.slice(0, 10)}
              </p>
            </button>
          ))}
        </div>
      )}

      {showNew && <NewShopModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-black/35">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}
