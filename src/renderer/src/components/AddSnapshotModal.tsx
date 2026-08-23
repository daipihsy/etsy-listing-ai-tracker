import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal, Field, Button, inputCls } from './ui'
import { ImageInput } from './ImageInput'
import { useToast } from './Toast'
import { parseLoose, today } from '../lib/format'

type Fields = {
  date: string
  ads_views: string
  ads_clicks: string
  ads_orders: string
  ads_revenue: string
  ads_spend: string
  roas: string
  organic_visits: string
  organic_orders: string
  organic_revenue: string
  favorites: string
  notes: string
}

const EMPTY: Fields = {
  date: today(),
  ads_views: '',
  ads_clicks: '',
  ads_orders: '',
  ads_revenue: '',
  ads_spend: '',
  roas: '',
  organic_visits: '',
  organic_orders: '',
  organic_revenue: '',
  favorites: '',
  notes: ''
}

export function AddSnapshotModal({
  listingId,
  onClose,
  onSaved
}: {
  listingId: number
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const toast = useToast()
  const [adsImg, setAdsImg] = useState<string | null>(null)
  const [orgImg, setOrgImg] = useState<string | null>(null)
  const [favImg, setFavImg] = useState<string | null>(null)
  const [f, setF] = useState<Fields>(EMPTY)
  const [pageText, setPageText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [clipHint, setClipHint] = useState(false)

  // 进入时自动检测剪贴板图片
  useEffect(() => {
    window.api.clipboard.image().then((url) => {
      if (url) setClipHint(true)
    })
  }, [])

  function up(patch: Partial<Fields>): void {
    setF((prev) => ({ ...prev, ...patch }))
  }

  async function useClipboard(): Promise<void> {
    const url = await window.api.clipboard.image()
    if (url) {
      setAdsImg(url)
      setClipHint(false)
      toast('已载入剪贴板图片到「广告截图」', 'info')
    }
  }

  async function analyzeText(): Promise<void> {
    if (!pageText.trim()) return toast('请先粘贴页面文本', 'error')
    setBusy('text')
    try {
      const r = await window.api.ai.extractSnapshotText(pageText)
      up({
        ads_views: r.views != null ? String(r.views) : f.ads_views,
        ads_clicks: r.clicks != null ? String(r.clicks) : f.ads_clicks,
        ads_orders: r.orders != null ? String(r.orders) : f.ads_orders,
        ads_revenue: r.revenue != null ? String(r.revenue) : f.ads_revenue,
        ads_spend: r.spend != null ? String(r.spend) : f.ads_spend,
        roas: r.roas != null ? String(r.roas) : f.roas,
        organic_visits: r.visits != null ? String(r.visits) : f.organic_visits,
        organic_orders: r.items_sold != null ? String(r.items_sold) : f.organic_orders,
        organic_revenue: r.organic_revenue != null ? String(r.organic_revenue) : f.organic_revenue,
        favorites: r.favorites != null ? String(r.favorites) : f.favorites
      })
      toast('已从文本解析并填入，请核对', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function analyzeAds(): Promise<void> {
    if (!adsImg) return toast('请先放入广告截图', 'error')
    setBusy('ads')
    try {
      const r = await window.api.ai.extractAds(adsImg)
      up({
        ads_views: r.views != null ? String(r.views) : f.ads_views,
        ads_clicks: r.clicks != null ? String(r.clicks) : f.ads_clicks,
        ads_orders: r.orders != null ? String(r.orders) : f.ads_orders,
        ads_revenue: r.revenue != null ? String(r.revenue) : f.ads_revenue,
        ads_spend: r.spend != null ? String(r.spend) : f.ads_spend,
        roas: r.roas != null ? String(r.roas) : f.roas
      })
      toast('广告数据识别完成，请核对', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function analyzeOrganic(): Promise<void> {
    if (!orgImg) return toast('请先放入自然流量截图', 'error')
    setBusy('org')
    try {
      const r = await window.api.ai.extractOrganic(orgImg)
      up({
        organic_visits: r.visits != null ? String(r.visits) : f.organic_visits,
        organic_orders: r.items_sold != null ? String(r.items_sold) : f.organic_orders,
        organic_revenue: r.revenue != null ? String(r.revenue) : f.organic_revenue
      })
      toast('自然数据识别完成，请核对', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function analyzeFav(): Promise<void> {
    if (!favImg) return toast('请先放入收藏截图', 'error')
    setBusy('fav')
    try {
      const r = await window.api.ai.extractFavorites(favImg)
      up({ favorites: r.favorites != null ? String(r.favorites) : f.favorites })
      toast('收藏数识别完成', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function save(): Promise<void> {
    if (!f.date) return toast('请填写日期', 'error')
    setSaving(true)
    try {
      await window.api.snapshots.create({
        listing_id: listingId,
        date: f.date,
        ads_views: parseLoose(f.ads_views),
        ads_clicks: parseLoose(f.ads_clicks),
        ads_orders: parseLoose(f.ads_orders),
        ads_revenue: parseLoose(f.ads_revenue),
        ads_spend: parseLoose(f.ads_spend),
        roas: parseLoose(f.roas),
        organic_visits: parseLoose(f.organic_visits),
        organic_orders: parseLoose(f.organic_orders),
        organic_revenue: parseLoose(f.organic_revenue),
        favorites: parseLoose(f.favorites),
        notes: f.notes.trim() || null,
        imageDataUrls: [adsImg, orgImg, favImg].filter(Boolean) as string[]
      })
      toast('已保存 Snapshot', 'success')
      onSaved()
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const numInput = (k: keyof Fields, label: string): JSX.Element => (
    <Field label={label}>
      <input className={inputCls} value={f[k]} onChange={(e) => up({ [k]: e.target.value })} />
    </Field>
  )

  return (
    <Modal title="Add Snapshot" onClose={onClose} wide>
      {clipHint && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-etsy/30 bg-etsy/5 px-4 py-3">
          <span className="text-sm text-ink">发现剪贴板图片，是否用于广告截图？</span>
          <div className="flex gap-2">
            <Button onClick={useClipboard}>Analyze</Button>
            <Button variant="ghost" onClick={() => setClipHint(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 推荐：粘贴文本 */}
      <div className="mb-4 rounded-xl border border-etsy/30 bg-etsy/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">① 推荐：粘贴页面文本（广告 / Listing Stats 均可，不超时）</p>
          <Button variant="subtle" loading={busy === 'text'} disabled={!pageText.trim()} onClick={analyzeText}>
            <Sparkles size={14} /> AI 解析文本
          </Button>
        </div>
        <p className="mb-2 text-xs text-black/45">
          在该 listing 的 Etsy 广告数据 / Listing Stats 页 ⌘A 全选 → ⌘C 复制 → 粘到这里点「AI 解析文本」，自动填下方数据。广告页和 Stats 页可分两次粘贴解析。
        </p>
        <textarea
          className={inputCls}
          rows={3}
          placeholder="把 Etsy 页面文字粘到这里…"
          value={pageText}
          onChange={(e) => setPageText(e.target.value)}
        />
      </div>

      <p className="mb-1.5 text-xs font-medium text-black/55">② 备选：粘贴截图让 AI 识别</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ImgSlot
          title="① 广告截图 Etsy Ads"
          img={adsImg}
          onChange={setAdsImg}
          onAnalyze={analyzeAds}
          busy={busy === 'ads'}
        />
        <ImgSlot
          title="② 自然流量 Listing Stats"
          img={orgImg}
          onChange={setOrgImg}
          onAnalyze={analyzeOrganic}
          busy={busy === 'org'}
        />
        <ImgSlot
          title="③ 收藏 Favorites（可选）"
          img={favImg}
          onChange={setFavImg}
          onAnalyze={analyzeFav}
          busy={busy === 'fav'}
        />
      </div>

      <div className="mt-5 rounded-xl border border-black/5 bg-black/[0.015] p-4">
        <p className="mb-3 text-sm font-semibold">确认数据（可手动修改）</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {numInput('date', '日期')}
          <div className="col-span-2 md:col-span-4 mt-1 text-xs font-semibold text-black/45">
            广告 Ads
          </div>
          {numInput('ads_views', 'Views')}
          {numInput('ads_clicks', 'Clicks')}
          {numInput('ads_orders', 'Orders')}
          {numInput('ads_revenue', 'Revenue')}
          {numInput('ads_spend', 'Spend')}
          {numInput('roas', 'ROAS')}
          <div className="col-span-2 md:col-span-4 mt-1 text-xs font-semibold text-black/45">
            自然 Organic
          </div>
          {numInput('organic_visits', 'Visits')}
          {numInput('organic_orders', 'Items Sold')}
          {numInput('organic_revenue', 'Revenue')}
          {numInput('favorites', 'Favorites')}
        </div>
        <div className="mt-3">
          <Field label="Notes（可选）">
            <input className={inputCls} value={f.notes} onChange={(e) => up({ notes: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={save}>
          Confirm 保存
        </Button>
      </div>
    </Modal>
  )
}

function ImgSlot({
  title,
  img,
  onChange,
  onAnalyze,
  busy
}: {
  title: string
  img: string | null
  onChange: (v: string | null) => void
  onAnalyze: () => void
  busy: boolean
}): JSX.Element {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-black/60">{title}</p>
      <ImageInput value={img} onChange={onChange} height="h-40" label="粘贴/拖拽截图" />
      <Button
        variant="subtle"
        className="mt-2 w-full"
        loading={busy}
        disabled={!img}
        onClick={onAnalyze}
      >
        <Sparkles size={14} /> AI 识别
      </Button>
    </div>
  )
}
