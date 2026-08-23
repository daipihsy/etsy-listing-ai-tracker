import { useRef, useState } from 'react'
import { Sparkles, FileUp } from 'lucide-react'
import { Modal, Field, Button, inputCls } from './ui'
import { ImageInput } from './ImageInput'
import { useToast } from './Toast'
import { parseLoose } from '../lib/format'
import { parseAdsCsv } from '../lib/csv'
import { parseAdsPageText } from '../lib/adsText'
import { parseStatsPageText } from '../lib/statsText'
import type { AdListingRow, StatsExtra } from '../../../shared/types'

const NUM_FIELDS = [
  'visits',
  'orders',
  'conversion_rate',
  'revenue',
  'ads_views',
  'ads_clicks',
  'ads_orders',
  'ads_revenue',
  'ads_spend',
  'roas',
  'click_rate',
  'fav_items',
  'shop_follows',
  'reviews_count',
  'review_avg',
  'repeat_buyers',
  'cities_reached',
  'abandoned_carts'
] as const
type NumField = (typeof NUM_FIELDS)[number]
type Fields = Record<NumField, string> & { date_range: string; notes: string }

const EMPTY = {
  date_range: '',
  notes: '',
  ...(Object.fromEntries(NUM_FIELDS.map((k) => [k, ''])) as Record<NumField, string>)
} as Fields

export function AddStoreSnapshotModal({
  shopId,
  onClose,
  onSaved
}: {
  shopId: number
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const toast = useToast()
  const [statsImg, setStatsImg] = useState<string | null>(null)
  const [adsImg, setAdsImg] = useState<string | null>(null)
  const [f, setF] = useState<Fields>(EMPTY)
  const [adListings, setAdListings] = useState<AdListingRow[]>([])
  const [dailyCsv, setDailyCsv] = useState<string | null>(null)
  const [csvText, setCsvText] = useState('')
  const [adPageText, setAdPageText] = useState('')
  const [statsText, setStatsText] = useState('')
  const [statsExtra, setStatsExtra] = useState<StatsExtra | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  const up = (patch: Partial<Fields>): void => setF((p) => ({ ...p, ...patch }))
  const setNum = (k: NumField, v: number | null | undefined): string | undefined =>
    v != null ? String(v) : undefined

  async function analyzeStats(): Promise<void> {
    if (!statsImg) return toast('请先放入整店统计截图', 'error')
    setBusy('stats')
    try {
      const r = await window.api.storeAi.extractStats(statsImg)
      up({
        date_range: r.date_range || f.date_range,
        visits: setNum('visits', r.visits) ?? f.visits,
        orders: setNum('orders', r.orders) ?? f.orders,
        conversion_rate: setNum('conversion_rate', r.conversion_rate) ?? f.conversion_rate,
        revenue: setNum('revenue', r.revenue) ?? f.revenue,
        fav_items: setNum('fav_items', r.fav_items) ?? f.fav_items,
        shop_follows: setNum('shop_follows', r.shop_follows) ?? f.shop_follows,
        reviews_count: setNum('reviews_count', r.reviews_count) ?? f.reviews_count,
        review_avg: setNum('review_avg', r.review_avg) ?? f.review_avg,
        repeat_buyers: setNum('repeat_buyers', r.repeat_buyers) ?? f.repeat_buyers,
        cities_reached: setNum('cities_reached', r.cities_reached) ?? f.cities_reached,
        abandoned_carts: setNum('abandoned_carts', r.abandoned_carts) ?? f.abandoned_carts
      })
      toast('整店统计识别完成，请核对', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function analyzeAds(): Promise<void> {
    if (!adsImg) return toast('请先放入整店广告截图', 'error')
    setBusy('ads')
    try {
      const r = await window.api.storeAi.extractAds(adsImg)
      up({
        date_range: f.date_range || r.date_range || '',
        ads_views: setNum('ads_views', r.views) ?? f.ads_views,
        ads_clicks: setNum('ads_clicks', r.clicks) ?? f.ads_clicks,
        ads_orders: setNum('ads_orders', r.orders) ?? f.ads_orders,
        ads_revenue: setNum('ads_revenue', r.revenue) ?? f.ads_revenue,
        ads_spend: setNum('ads_spend', r.spend) ?? f.ads_spend,
        roas: setNum('roas', r.roas) ?? f.roas,
        click_rate: setNum('click_rate', r.click_rate) ?? f.click_rate
      })
      if (Array.isArray(r.listings) && r.listings.length) setAdListings(r.listings)
      toast(
        `整店广告识别完成${r.listings?.length ? `，含 ${r.listings.length} 个单链接明细` : ''}，请核对`,
        'success'
      )
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  function applyStatsPageText(text: string): void {
    try {
      const p = parseStatsPageText(text)
      const s = (v: number | null): string | undefined => (v != null ? String(v) : undefined)
      up({
        date_range: f.date_range || p.date_range,
        visits: s(p.visits) ?? f.visits,
        orders: s(p.orders) ?? f.orders,
        conversion_rate: s(p.conversion_rate) ?? f.conversion_rate,
        revenue: s(p.revenue) ?? f.revenue,
        fav_items: s(p.fav_items) ?? f.fav_items,
        shop_follows: s(p.shop_follows) ?? f.shop_follows,
        reviews_count: s(p.reviews_count) ?? f.reviews_count,
        review_avg: s(p.review_avg) ?? f.review_avg,
        repeat_buyers: s(p.repeat_buyers) ?? f.repeat_buyers,
        cities_reached: s(p.cities_reached) ?? f.cities_reached,
        abandoned_carts: s(p.abandoned_carts) ?? f.abandoned_carts
      })
      setStatsExtra({ traffic_sources: p.traffic_sources, top_listings: p.top_listings })
      toast(
        `已解析 Stats：流量+Shopper 数据；流量来源 ${p.traffic_sources.length} 项、自然 top ${p.top_listings.length} 条`,
        'success'
      )
    } catch (e) {
      toast('Stats 文本解析失败：' + String(e), 'error')
    }
  }

  function applyAdsPageText(text: string): void {
    try {
      const p = parseAdsPageText(text)
      if (p.listings.length) setAdListings(p.listings)
      const t = p.totals
      up({
        date_range: f.date_range || p.date_range,
        ads_views: t.views != null ? String(t.views) : f.ads_views,
        ads_clicks: t.clicks != null ? String(t.clicks) : f.ads_clicks,
        ads_orders: t.orders != null ? String(t.orders) : f.ads_orders,
        ads_revenue: t.revenue != null ? String(t.revenue) : f.ads_revenue,
        ads_spend: t.spend != null ? String(t.spend) : f.ads_spend,
        roas: t.roas != null ? String(t.roas) : f.roas,
        click_rate: t.click_rate != null ? String(t.click_rate) : f.click_rate
      })
      toast(`已解析：整店汇总 + ${p.listings.length} 条单链接明细`, 'success')
    } catch (e) {
      toast('文本解析失败：' + String(e), 'error')
    }
  }

  async function aiParseAdsText(): Promise<void> {
    if (!adPageText.trim()) return
    setBusy('adtext')
    try {
      const r = await window.api.storeAi.extractAdsText(adPageText)
      if (Array.isArray(r.listings) && r.listings.length) setAdListings(r.listings)
      up({
        date_range: f.date_range || r.date_range || '',
        ads_views: r.views != null ? String(r.views) : f.ads_views,
        ads_clicks: r.clicks != null ? String(r.clicks) : f.ads_clicks,
        ads_orders: r.orders != null ? String(r.orders) : f.ads_orders,
        ads_revenue: r.revenue != null ? String(r.revenue) : f.ads_revenue,
        ads_spend: r.spend != null ? String(r.spend) : f.ads_spend,
        roas: r.roas != null ? String(r.roas) : f.roas,
        click_rate: r.click_rate != null ? String(r.click_rate) : f.click_rate
      })
      toast(`AI 已解析：整店汇总 + ${r.listings?.length ?? 0} 条单链接`, 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  function applyCsv(text: string): void {
    try {
      const p = parseAdsCsv(text)
      setDailyCsv(JSON.stringify(p.rows))
      up({
        date_range: f.date_range || (p.totals.dateStart ? `${p.totals.dateStart} - ${p.totals.dateEnd}` : ''),
        ads_views: String(p.totals.views),
        ads_clicks: String(p.totals.clicks),
        ads_orders: String(p.totals.orders),
        ads_revenue: String(+p.totals.revenue.toFixed(2)),
        ads_spend: String(+p.totals.spend.toFixed(2)),
        roas: p.totals.roas != null ? String(p.totals.roas) : f.roas,
        click_rate: p.totals.click_rate != null ? String(p.totals.click_rate) : f.click_rate
      })
      toast(`已导入 CSV：${p.rows.length} 天，广告汇总已自动填入`, 'success')
    } catch (e) {
      toast('CSV 解析失败：' + String(e), 'error')
    }
  }

  async function onCsvFile(file: File | undefined): Promise<void> {
    if (!file) return
    applyCsv(await file.text())
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      const numvals = Object.fromEntries(
        NUM_FIELDS.map((k) => [k, parseLoose(f[k])])
      ) as Record<NumField, number | null>
      // Click rate 没填就自己算（clicks ÷ views）
      if (numvals.click_rate == null && numvals.ads_clicks != null && numvals.ads_views) {
        numvals.click_rate = +((numvals.ads_clicks / numvals.ads_views) * 100).toFixed(2)
      }
      // 整店分析只保存「文本记录」（数字 + 单链接明细），不落盘原始截图——长期看文本才有效
      await window.api.storeSnapshots.create({
        shop_id: shopId,
        date_range: f.date_range.trim(),
        ...numvals,
        daily_csv: dailyCsv,
        ad_listings: adListings.length ? JSON.stringify(adListings) : null,
        stats_extra: statsExtra ? JSON.stringify(statsExtra) : null,
        notes: f.notes.trim() || null
      })
      toast('已保存整店快照', 'success')
      onSaved()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const NumInput = ({ k, label }: { k: NumField; label: string }): JSX.Element => (
    <Field label={label}>
      <input className={inputCls} value={f[k]} onChange={(e) => up({ [k]: e.target.value } as Partial<Fields>)} />
    </Field>
  )

  return (
    <Modal title="添加整店数据" onClose={onClose} wide>
      <p className="mb-3 text-xs text-black/45">
        推荐用「粘贴整页文本」——最快、不会超时，能一次抓全所有单链接。截图仅用于 AI 识别、<b>不保存原图</b>。
      </p>

      {/* 推荐：粘贴整页文本 */}
      <div className="mb-4 rounded-xl border border-etsy/30 bg-etsy/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">① 推荐：粘贴 Etsy 广告整页文本（最快 · 不超时）</p>
          <div className="flex gap-2">
            <Button disabled={!adPageText.trim()} onClick={() => applyAdsPageText(adPageText)}>
              解析文本
            </Button>
            <Button
              variant="subtle"
              disabled={!adPageText.trim()}
              loading={busy === 'adtext'}
              onClick={aiParseAdsText}
            >
              AI 解析（更容错）
            </Button>
          </div>
        </div>
        <p className="mb-2 text-xs text-black/45">
          在 Etsy 广告页 ⌘A 全选 → ⌘C 复制 → 粘到这里点「解析文本」。会自动填好整店广告汇总，并抓出每个单链接的明细（含当前策略）。
        </p>
        <textarea
          className={inputCls}
          rows={3}
          placeholder="把整个 Etsy Ads 页面的文字粘到这里…"
          value={adPageText}
          onChange={(e) => setAdPageText(e.target.value)}
        />
      </div>

      {/* 推荐：粘贴 Stats 整页文本 */}
      <div className="mb-4 rounded-xl border border-etsy/30 bg-etsy/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">① 推荐：粘贴 Etsy Stats 整页文本（自动填流量 + Shopper + 流量来源）</p>
          <Button disabled={!statsText.trim()} onClick={() => applyStatsPageText(statsText)}>
            解析文本
          </Button>
        </div>
        <p className="mb-2 text-xs text-black/45">
          在 Etsy「Stats / Shop stats」页 ⌘A 全选 → ⌘C 复制 → 粘到这里点「解析文本」。兼容不同店铺的页面格式。
        </p>
        <textarea
          className={inputCls}
          rows={3}
          placeholder="把整个 Etsy Stats 页面的文字粘到这里…"
          value={statsText}
          onChange={(e) => setStatsText(e.target.value)}
        />
        {statsExtra && (
          <p className="mt-2 text-xs text-emerald-600">
            ✓ 已载入流量来源 {statsExtra.traffic_sources.length} 项、自然 top {statsExtra.top_listings.length} 条（随快照保存供 AI 分析）
          </p>
        )}
      </div>

      {/* 截图识别（备选） */}
      <p className="mb-1.5 text-xs font-medium text-black/55">② 备选：粘贴截图让 AI 识别</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-black/60">① 整店统计截图（Stats 页）</p>
          <ImageInput value={statsImg} onChange={setStatsImg} height="h-40" label="粘贴/拖拽 Stats 截图" />
          <Button variant="subtle" className="mt-2 w-full" loading={busy === 'stats'} disabled={!statsImg} onClick={analyzeStats}>
            <Sparkles size={14} /> AI 识别
          </Button>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-black/60">② 整店广告截图（Ads 页顶部汇总）</p>
          <ImageInput value={adsImg} onChange={setAdsImg} height="h-40" label="粘贴/拖拽 Ads 截图" />
          <Button variant="subtle" className="mt-2 w-full" loading={busy === 'ads'} disabled={!adsImg} onClick={analyzeAds}>
            <Sparkles size={14} /> AI 识别
          </Button>
        </div>
      </div>

      {/* CSV 导入 */}
      <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.015] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">或：导入广告每日 CSV（自动汇总 + 生成趋势）</p>
          <Button variant="subtle" onClick={() => csvRef.current?.click()}>
            <FileUp size={14} /> 选择 CSV 文件
          </Button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onCsvFile(e.target.files?.[0])}
          />
        </div>
        <textarea
          className={inputCls}
          rows={2}
          placeholder="也可直接把 CSV 内容粘贴到这里，然后点右侧「解析」"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button variant="subtle" disabled={!csvText.trim()} onClick={() => applyCsv(csvText)}>
            解析粘贴的 CSV
          </Button>
          {dailyCsv && (
            <span className="text-xs text-emerald-600">✓ 已载入每日数据（保存后可在详情页看趋势）</span>
          )}
        </div>
      </div>

      {/* 确认字段 */}
      <div className="mt-4 rounded-xl border border-black/5 bg-white p-4">
        <p className="mb-3 text-sm font-semibold">确认数据（可手动修改）</p>
        <div className="mb-2">
          <Field label="统计周期（如 Jul 24 - Aug 22）">
            <input className={inputCls} value={f.date_range} onChange={(e) => up({ date_range: e.target.value })} />
          </Field>
        </div>
        <p className="mb-1 mt-2 text-xs font-semibold text-black/45">整店流量</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumInput k="visits" label="Visits" />
          <NumInput k="orders" label="Orders" />
          <NumInput k="conversion_rate" label="转化率 %" />
          <NumInput k="revenue" label="Revenue" />
        </div>
        <p className="mb-1 mt-3 text-xs font-semibold text-black/45">整店广告</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumInput k="ads_views" label="Views" />
          <NumInput k="ads_clicks" label="Clicks" />
          <NumInput k="ads_orders" label="Orders" />
          <NumInput k="ads_revenue" label="Revenue" />
          <NumInput k="ads_spend" label="Spend" />
          <NumInput k="roas" label="ROAS" />
          <NumInput k="click_rate" label="Click rate %" />
        </div>
        <p className="mb-1 mt-3 text-xs font-semibold text-black/45">Shopper Stats</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumInput k="fav_items" label="Item favorites" />
          <NumInput k="shop_follows" label="Shop follows" />
          <NumInput k="reviews_count" label="Reviews 数" />
          <NumInput k="review_avg" label="Reviews 均分" />
          <NumInput k="repeat_buyers" label="Repeat buyers" />
          <NumInput k="cities_reached" label="Cities reached" />
          <NumInput k="abandoned_carts" label="Abandoned carts" />
        </div>
        {adListings.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-black/45">
              单链接广告明细（AI 识别 {adListings.length} 条，将随快照保存供 AI 分析）
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-black/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-black/[0.03] text-black/45">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Listing</th>
                    <th className="px-2 py-1 text-left font-medium">策略</th>
                    <th className="px-2 py-1 text-right font-medium">Spend</th>
                    <th className="px-2 py-1 text-right font-medium">Orders</th>
                    <th className="px-2 py-1 text-right font-medium">ROAS</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {adListings.map((l, i) => (
                    <tr key={i} className="border-t border-black/5">
                      <td className="max-w-[220px] truncate px-2 py-1" title={l.name}>
                        {l.name}
                      </td>
                      <td className="px-2 py-1 text-black/50">{l.strategy ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.spend ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.orders ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.roas ?? '—'}</td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => setAdListings((a) => a.filter((_, idx) => idx !== i))}
                          className="text-black/30 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Field label="备注（可选）">
            <input className={inputCls} value={f.notes} onChange={(e) => up({ notes: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button loading={saving} onClick={save}>
          保存
        </Button>
      </div>
    </Modal>
  )
}
