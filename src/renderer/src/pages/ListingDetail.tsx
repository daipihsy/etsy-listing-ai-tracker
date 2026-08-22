import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  Sparkles,
  Trash2,
  Wrench
} from 'lucide-react'
import { StoredImage } from '../components/StoredImage'
import { Button } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { Timeline } from '../components/Timeline'
import { AddSnapshotModal } from '../components/AddSnapshotModal'
import { AddActionModal } from '../components/AddActionModal'
import { useToast } from '../components/Toast'
import { ctr, cvr, money, num, pct, totalOrders, totalRevenue } from '../lib/format'
import { buildSummaryContext, computeBeforeAfter } from '../lib/analysis'
import type { Listing, Snapshot, Action, ActionEffect } from '../../../shared/types'

const DECISIONS = ['继续投入', '保持', '停止关注', '测试其他方案']

export function ListingDetail(): JSX.Element {
  const { id } = useParams()
  const listingId = Number(id)
  const nav = useNavigate()
  const toast = useToast()

  const [listing, setListing] = useState<Listing | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [showSnap, setShowSnap] = useState(false)
  const [showAction, setShowAction] = useState(false)
  const [askAction, setAskAction] = useState(false)
  const [summarizing, setSummarizing] = useState(false)

  const load = useCallback(async () => {
    const [l, s, a] = await Promise.all([
      window.api.listings.get(listingId),
      window.api.snapshots.list(listingId),
      window.api.actions.list(listingId)
    ])
    setListing(l)
    setSnapshots(s)
    setActions(a)
  }, [listingId])

  useEffect(() => {
    load()
  }, [load])

  if (!listing) return <p className="p-8 text-black/40">加载中…</p>

  const latest = snapshots[snapshots.length - 1] || null

  async function setDecision(d: string): Promise<void> {
    await window.api.listings.update(listingId, { decision: d })
    setListing((prev) => (prev ? { ...prev, decision: d } : prev))
  }

  async function removeListing(): Promise<void> {
    if (!confirm(`删除「${listing!.name}」及其全部记录？此操作不可撤销。`)) return
    await window.api.listings.remove(listingId)
    nav('/listings')
  }

  async function genSummary(): Promise<void> {
    setSummarizing(true)
    try {
      const ctx = buildSummaryContext(listing!.name, snapshots, actions)
      const text = await window.api.ai.summarizeListing(ctx)
      const at = new Date().toISOString()
      await window.api.listings.update(listingId, { ai_summary: text, ai_summary_at: at })
      setListing((prev) => (prev ? { ...prev, ai_summary: text, ai_summary_at: at } : prev))
      toast('已生成 AI 复盘', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      {/* 顶部 */}
      <button
        onClick={() => nav('/listings')}
        className="mb-4 flex items-center gap-1 text-sm text-black/50 hover:text-black"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="flex gap-5">
        <StoredImage
          filename={listing.image_path}
          className="h-28 w-28 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{listing.name}</h1>
              {listing.notes && <p className="mt-0.5 text-sm text-black/45">{listing.notes}</p>}
              {listing.etsy_url && (
                <a
                  href={listing.etsy_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-etsy hover:underline"
                >
                  打开 Etsy 链接 <ExternalLink size={13} />
                </a>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setShowSnap(true)}>
                <Camera size={15} /> Add Snapshot
              </Button>
              <Button variant="subtle" onClick={() => setShowAction(true)}>
                <Wrench size={15} /> 记录动作
              </Button>
              <Button variant="ghost" onClick={removeListing} className="px-2">
                <Trash2 size={15} className="text-red-500" />
              </Button>
            </div>
          </div>

          {/* Decision */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-black/40">My Decision：</span>
            {DECISIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDecision(d)}
                className={
                  'rounded-full px-2.5 py-1 text-xs transition ' +
                  (listing.decision === d
                    ? 'bg-ink text-white'
                    : 'bg-black/5 text-black/55 hover:bg-black/10')
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 当前数据 */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label="CTR" value={pct(ctr(latest))} />
        <Stat label="CVR" value={pct(cvr(latest))} />
        <Stat label="ROAS" value={latest?.roas != null ? num(latest.roas, 2) : '—'} />
        <Stat label="Orders" value={num(totalOrders(latest))} />
        <Stat label="Revenue" value={money(totalRevenue(latest))} />
        <Stat label="Ad Spend" value={money(latest?.ads_spend ?? null)} />
      </div>

      {/* 趋势图 */}
      <Section title="趋势">
        <TrendChart snapshots={snapshots} actions={actions} />
      </Section>

      {/* AI 复盘 */}
      <Section
        title="AI Summary 复盘"
        action={
          <Button variant="subtle" loading={summarizing} onClick={genSummary}>
            <Sparkles size={14} /> {listing.ai_summary ? '重新生成' : '生成复盘'}
          </Button>
        }
      >
        {listing.ai_summary ? (
          <>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-black/80">
              {listing.ai_summary}
            </pre>
            <p className="mt-2 text-[11px] text-black/30">
              生成于 {listing.ai_summary_at?.slice(0, 16).replace('T', ' ')} · AI 仅辅助，最终判断由你决定
            </p>
          </>
        ) : (
          <p className="text-sm text-black/35">
            点击「生成复盘」，AI 会读取全部 Snapshot 与 Action，给出趋势、有效/无效动作、风险与建议。
          </p>
        )}
      </Section>

      {/* Actions 效果分析 */}
      <Section title="运营动作与效果">
        {actions.length === 0 ? (
          <p className="text-sm text-black/35">还没有运营动作。</p>
        ) : (
          <div className="space-y-4">
            {[...actions]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((a) => (
                <ActionCard key={a.id} action={a} snapshots={snapshots} onChanged={load} />
              ))}
          </div>
        )}
      </Section>

      {/* Timeline */}
      <Section title="Timeline">
        <Timeline snapshots={snapshots} actions={actions} />
      </Section>

      {showSnap && (
        <AddSnapshotModal
          listingId={listingId}
          onClose={() => setShowSnap(false)}
          onSaved={() => {
            setShowSnap(false)
            setAskAction(true)
            load()
          }}
        />
      )}
      {showAction && (
        <AddActionModal
          listingId={listingId}
          onClose={() => setShowAction(false)}
          onSaved={() => {
            setShowAction(false)
            load()
          }}
        />
      )}

      {/* Snapshot 保存后询问是否记录动作 */}
      {askAction && (
        <div className="no-drag fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <p className="font-medium">今天是否做了运营动作？</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setAskAction(false)}
              >
                No Action
              </Button>
              <Button
                onClick={() => {
                  setAskAction(false)
                  setShowAction(true)
                }}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2.5 text-center shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-black/35">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
  action
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}): JSX.Element {
  return (
    <section className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ActionCard({
  action,
  snapshots,
  onChanged
}: {
  action: Action
  snapshots: Snapshot[]
  onChanged: () => void
}): JSX.Element {
  const ba = computeBeforeAfter(action, snapshots)
  const [conclusion, setConclusion] = useState(action.conclusion || '')

  async function setEffect(effect: ActionEffect): Promise<void> {
    await window.api.actions.update(action.id, { effect })
    onChanged()
  }
  async function saveConclusion(): Promise<void> {
    if (conclusion === (action.conclusion || '')) return
    await window.api.actions.update(action.id, { conclusion: conclusion.trim() || null })
    onChanged()
  }
  async function remove(): Promise<void> {
    if (!confirm('删除该动作记录？')) return
    await window.api.actions.remove(action.id)
    onChanged()
  }

  return (
    <div className="rounded-xl border border-black/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="mr-2 rounded bg-etsy/15 px-1.5 py-0.5 text-[11px] font-medium text-etsy">
            {action.type}
          </span>
          <span className="text-sm text-black/45">{action.date}</span>
          {action.review_date && (
            <span className="ml-2 text-[11px] text-black/35">复盘 {action.review_date}</span>
          )}
        </div>
        <button onClick={remove} className="text-black/30 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      {action.ai_summary ? (
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-black/75">
          {action.ai_summary}
        </pre>
      ) : (
        <p className="mt-2 text-sm text-black/75">{action.raw_text}</p>
      )}

      {/* Before / After */}
      {ba.after ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-black/5">
          <table className="w-full text-xs">
            <thead className="bg-black/[0.03] text-black/45">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">指标</th>
                <th className="px-2 py-1.5 text-right font-medium">Before ({ba.before?.date})</th>
                <th className="px-2 py-1.5 text-right font-medium">After ({ba.after.date})</th>
                <th className="px-2 py-1.5 text-right font-medium">变化</th>
              </tr>
            </thead>
            <tbody>
              {ba.rows.map((r) => (
                <tr key={r.label} className="border-t border-black/5">
                  <td className="px-2 py-1.5 text-black/60">{r.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.before}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.after}</td>
                  <td
                    className={
                      'px-2 py-1.5 text-right tabular-nums ' +
                      (r.delta == null
                        ? 'text-black/30'
                        : r.delta > 0
                          ? 'text-emerald-600'
                          : r.delta < 0
                            ? 'text-red-500'
                            : 'text-black/40')
                    }
                  >
                    {r.delta == null ? '—' : r.delta > 0 ? '↑' : r.delta < 0 ? '↓' : '→'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-xs text-black/30">动作后暂无新的 Snapshot，无法比较效果。</p>
      )}

      {/* 效果判断 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-black/40">效果：</span>
        {(['Effective', 'Neutral', 'Ineffective'] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEffect(action.effect === e ? null : e)}
            className={
              'rounded-full px-2.5 py-1 text-xs transition ' +
              (action.effect === e
                ? e === 'Effective'
                  ? 'bg-emerald-600 text-white'
                  : e === 'Ineffective'
                    ? 'bg-red-500 text-white'
                    : 'bg-black/60 text-white'
                : 'bg-black/5 text-black/55 hover:bg-black/10')
            }
          >
            {e}
          </button>
        ))}
      </div>
      <textarea
        className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-etsy"
        rows={2}
        placeholder="My Conclusion（我的结论）"
        value={conclusion}
        onChange={(e) => setConclusion(e.target.value)}
        onBlur={saveConclusion}
      />
    </div>
  )
}
