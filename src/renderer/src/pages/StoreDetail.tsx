import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Sparkles } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { Button } from '../components/ui'
import { AddStoreSnapshotModal } from '../components/AddStoreSnapshotModal'
import { StoreChat } from '../components/StoreChat'
import { useToast } from '../components/Toast'
import { money, num } from '../lib/format'
import type { DailyRow } from '../lib/csv'
import type { Shop, StoreSnapshot, AdListingRow, StatsExtra } from '../../../shared/types'

function parseAdListings(json: string | null): AdListingRow[] {
  if (!json) return []
  try {
    const a = JSON.parse(json)
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function parseStatsExtra(json: string | null): StatsExtra | null {
  if (!json) return null
  try {
    const a = JSON.parse(json)
    return a && Array.isArray(a.traffic_sources) ? a : null
  } catch {
    return null
  }
}

const DAILY_METRICS: { key: keyof DailyRow; label: string; money?: boolean }[] = [
  { key: 'views', label: 'Views' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'orders', label: 'Orders' },
  { key: 'revenue', label: 'Revenue', money: true },
  { key: 'spend', label: 'Spend', money: true },
  { key: 'roas', label: 'ROAS' }
]

function parseDaily(csv: string | null): DailyRow[] {
  if (!csv) return []
  try {
    const a = JSON.parse(csv)
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function buildContext(shop: Shop, snaps: StoreSnapshot[]): string {
  const lines = snaps.map((s) => {
    return `周期 ${s.date_range || '?'}: Visits ${s.visits ?? '—'}, Orders ${s.orders ?? '—'}, 转化率 ${
      s.conversion_rate ?? '—'
    }%, Revenue ${s.revenue ?? '—'} | 广告 Views ${s.ads_views ?? '—'}, Clicks ${
      s.ads_clicks ?? '—'
    }, Ad Orders ${s.ads_orders ?? '—'}, Ad Revenue ${s.ads_revenue ?? '—'}, Spend ${
      s.ads_spend ?? '—'
    }, ROAS ${s.roas ?? '—'} | 收藏 ${s.fav_items ?? '—'}, 关注 ${s.shop_follows ?? '—'}, 评价 ${
      s.reviews_count ?? '—'
    }(均分${s.review_avg ?? '—'}), 复购 ${s.repeat_buyers ?? '—'}, 触达城市 ${
      s.cities_reached ?? '—'
    }, 弃单 ${s.abandoned_carts ?? '—'}`
  })
  const latest = snaps[snaps.length - 1]
  const daily = parseDaily(latest?.daily_csv || null)
  let dailyStr = ''
  if (daily.length) {
    dailyStr =
      '\n最近一期每日广告序列（date, views, clicks, orders, revenue, spend, roas）：\n' +
      daily
        .map(
          (d) =>
            `${d.date}, ${d.views ?? ''}, ${d.clicks ?? ''}, ${d.orders ?? ''}, ${
              d.revenue ?? ''
            }, ${d.spend ?? ''}, ${d.roas ?? ''}`
        )
        .join('\n')
  }
  const ads = parseAdListings(latest?.ad_listings || null)
  let adStr = ''
  if (ads.length) {
    adStr =
      '\n\n最近一期广告页各单链接明细（listing | 当前策略 | views, clicks, click_rate%, orders, revenue, spend, roas）：\n' +
      ads
        .map(
          (a) =>
            `${a.name} | ${a.strategy ?? '-'} | ${a.views ?? ''}, ${a.clicks ?? ''}, ${
              a.click_rate ?? ''
            }, ${a.orders ?? ''}, ${a.revenue ?? ''}, ${a.spend ?? ''}, ${a.roas ?? ''}`
        )
        .join('\n')
  }
  const extra = parseStatsExtra(latest?.stats_extra || null)
  let extraStr = ''
  if (extra) {
    if (extra.traffic_sources.length) {
      extraStr +=
        '\n\n最近一期流量来源（来源: 访问数）：\n' +
        extra.traffic_sources.map((t) => `${t.name}: ${t.visits ?? '—'}`).join('；')
    }
    if (extra.top_listings.length) {
      extraStr +=
        '\n\n自然流量 top listings（listing | views, favorites, orders, revenue）：\n' +
        extra.top_listings
          .map(
            (t) =>
              `${t.name} | ${t.views ?? ''}, ${t.favorites ?? ''}, ${t.orders ?? ''}, ${
                t.revenue ?? ''
              }`
          )
          .join('\n')
    }
  }
  return `店铺：${shop.name}${shop.notes ? '（' + shop.notes + '）' : ''}\n\n历史整店快照：\n${lines.join(
    '\n'
  )}${dailyStr}${adStr}${extraStr}`
}

export function StoreDetail(): JSX.Element {
  const { id } = useParams()
  const shopId = Number(id)
  const nav = useNavigate()
  const toast = useToast()

  const [shop, setShop] = useState<Shop | null>(null)
  const [snaps, setSnaps] = useState<StoreSnapshot[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [advising, setAdvising] = useState(false)
  const [metric, setMetric] = useState<keyof DailyRow>('revenue')

  const load = useCallback(async () => {
    const [s, list] = await Promise.all([
      window.api.shops.get(shopId),
      window.api.storeSnapshots.list(shopId)
    ])
    setShop(s)
    setSnaps(list)
  }, [shopId])
  useEffect(() => {
    load()
  }, [load])

  if (!shop) return <p className="p-8 text-black/40">加载中…</p>

  const latest = snaps[snaps.length - 1] || null
  const daily = parseDaily(latest?.daily_csv || null)
  const adListings = parseAdListings(latest?.ad_listings || null)
  const statsExtra = parseStatsExtra(latest?.stats_extra || null)
  const activeMetric = DAILY_METRICS.find((m) => m.key === metric)!

  async function removeShop(): Promise<void> {
    if (!confirm(`删除店铺「${shop!.name}」及其全部整店数据？不可撤销。`)) return
    await window.api.shops.remove(shopId)
    nav('/stores')
  }

  async function genAdvice(): Promise<void> {
    if (snaps.length === 0) return toast('先添加整店数据', 'error')
    setAdvising(true)
    try {
      const text = await window.api.storeAi.advice(shopId, buildContext(shop!, snaps))
      setShop((p) => (p ? { ...p, ai_advice: text, ai_advice_at: new Date().toISOString() } : p))
      toast('已生成优化建议', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setAdvising(false)
    }
  }

  async function delSnap(sid: number): Promise<void> {
    if (!confirm('删除这条整店快照？')) return
    await window.api.storeSnapshots.remove(sid)
    load()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      <button
        onClick={() => nav('/stores')}
        className="mb-4 flex items-center gap-1 text-sm text-black/50 hover:text-black"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{shop.name}</h1>
          {shop.notes && <p className="mt-0.5 text-sm text-black/45">{shop.notes}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={15} /> 添加整店数据
          </Button>
          <Button variant="ghost" onClick={removeShop} className="px-2">
            <Trash2 size={15} className="text-red-500" />
          </Button>
        </div>
      </div>

      {/* 当前数据 */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Visits" value={num(latest?.visits ?? null)} />
        <Stat label="Orders" value={num(latest?.orders ?? null)} />
        <Stat label="转化率" value={latest?.conversion_rate != null ? latest.conversion_rate + '%' : '—'} />
        <Stat label="Revenue" value={money(latest?.revenue ?? null)} />
        <Stat label="广告花费" value={money(latest?.ads_spend ?? null)} />
        <Stat label="广告 ROAS" value={latest?.roas != null ? num(latest.roas, 2) : '—'} />
        <Stat label="复购" value={num(latest?.repeat_buyers ?? null)} />
      </div>
      {latest?.date_range && (
        <p className="mt-1 text-xs text-black/35">最新周期：{latest.date_range}</p>
      )}

      {/* 每日趋势（来自 CSV） */}
      <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">广告每日趋势{daily.length ? `（${latest?.date_range || ''}）` : ''}</h2>
        {daily.length === 0 ? (
          <p className="py-10 text-center text-sm text-black/30">
            最近一期没有每日数据。添加整店数据时导入广告 CSV 即可看到每日趋势。
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {DAILY_METRICS.map((m) => (
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
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={daily} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#00000040" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#00000040"
                  width={54}
                  tickFormatter={(v) => (activeMetric.money ? '$' + v : String(v))}
                />
                <Tooltip
                  formatter={(v: number) => [activeMetric.money ? '$' + v : v, activeMetric.label]}
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #eee' }}
                />
                <Line type="monotone" dataKey={metric} stroke="#F1641E" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </section>

      {/* 流量来源 */}
      {statsExtra && statsExtra.traffic_sources.length > 0 && (
        <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">流量来源</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statsExtra.traffic_sources.map((t) => (
              <div key={t.name} className="rounded-xl border border-black/5 px-3 py-2">
                <p className="text-[11px] leading-tight text-black/45">{t.name}</p>
                <p className="mt-0.5 font-semibold tabular-nums">{num(t.visits ?? null)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 自然流量 top listings */}
      {statsExtra && statsExtra.top_listings.length > 0 && (
        <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">自然流量 Top Listings（{statsExtra.top_listings.length}）</h2>
          <div className="overflow-x-auto rounded-lg border border-black/5">
            <table className="w-full text-xs">
              <thead className="bg-black/[0.03] text-black/45">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Listing</th>
                  <th className="px-2 py-1.5 text-right font-medium">Views</th>
                  <th className="px-2 py-1.5 text-right font-medium">Favorites</th>
                  <th className="px-2 py-1.5 text-right font-medium">Orders</th>
                  <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {statsExtra.top_listings.map((t, i) => (
                  <tr key={i} className="border-t border-black/5">
                    <td className="max-w-[300px] truncate px-2 py-1.5" title={t.name}>
                      {t.name}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(t.views ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(t.favorites ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(t.orders ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(t.revenue ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 单链接广告明细（文本记录） */}
      {adListings.length > 0 && (
        <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">单链接广告明细（{adListings.length} 条 · AI 已记录，供分析）</h2>
          <div className="max-h-80 overflow-auto rounded-lg border border-black/5">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/[0.03] text-black/45">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Listing</th>
                  <th className="px-2 py-1.5 text-left font-medium">策略</th>
                  <th className="px-2 py-1.5 text-right font-medium">Views</th>
                  <th className="px-2 py-1.5 text-right font-medium">Clicks</th>
                  <th className="px-2 py-1.5 text-right font-medium">CTR%</th>
                  <th className="px-2 py-1.5 text-right font-medium">Orders</th>
                  <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                  <th className="px-2 py-1.5 text-right font-medium">Spend</th>
                  <th className="px-2 py-1.5 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {adListings.map((a, i) => (
                  <tr key={i} className="border-t border-black/5">
                    <td className="max-w-[240px] truncate px-2 py-1.5" title={a.name}>
                      {a.name}
                    </td>
                    <td className="px-2 py-1.5 text-black/50">{a.strategy ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(a.views ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(a.clicks ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.click_rate ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(a.orders ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(a.revenue ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(a.spend ?? null)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {a.roas != null ? num(a.roas, 2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* AI 优化建议 */}
      <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">AI 优化建议</h2>
          <Button variant="subtle" loading={advising} onClick={genAdvice}>
            <Sparkles size={14} /> {shop.ai_advice ? '重新生成' : '生成建议'}
          </Button>
        </div>
        {shop.ai_advice ? (
          <>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-black/80">
              {shop.ai_advice}
            </pre>
            <p className="mt-2 text-[11px] text-black/30">
              生成于 {shop.ai_advice_at?.slice(0, 16).replace('T', ' ')} · AI 仅辅助
            </p>
          </>
        ) : (
          <p className="text-sm text-black/35">点「生成建议」，AI 会基于本店所有整店数据给出可执行的优化建议。</p>
        )}
      </section>

      {/* AI 对话 */}
      <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <StoreChat shopId={shopId} buildContext={() => buildContext(shop!, snaps)} />
      </section>

      {/* 快照历史 */}
      <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">数据记录（{snaps.length}）</h2>
        {snaps.length === 0 ? (
          <p className="text-sm text-black/35">还没有整店数据。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-black/45">
                <tr className="border-b border-black/5">
                  <th className="px-2 py-1.5 text-left font-medium">周期</th>
                  <th className="px-2 py-1.5 text-right font-medium">Visits</th>
                  <th className="px-2 py-1.5 text-right font-medium">Orders</th>
                  <th className="px-2 py-1.5 text-right font-medium">转化率</th>
                  <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                  <th className="px-2 py-1.5 text-right font-medium">ROAS</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {[...snaps].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-black/5">
                    <td className="px-2 py-1.5">{s.date_range || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(s.visits)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(s.orders)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {s.conversion_rate != null ? s.conversion_rate + '%' : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(s.revenue)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {s.roas != null ? num(s.roas, 2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => delSnap(s.id)} className="text-black/30 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && (
        <AddStoreSnapshotModal
          shopId={shopId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2.5 text-center shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-black/35">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}
