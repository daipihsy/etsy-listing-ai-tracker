import { Camera, Wrench } from 'lucide-react'
import type { Snapshot, Action } from '../../../shared/types'
import { ctr, cvr, money, num, pct } from '../lib/format'

type Ev =
  | { kind: 'snap'; date: string; data: Snapshot }
  | { kind: 'action'; date: string; data: Action }

export function Timeline({
  snapshots,
  actions
}: {
  snapshots: Snapshot[]
  actions: Action[]
}): JSX.Element {
  const events: Ev[] = [
    ...snapshots.map((s) => ({ kind: 'snap' as const, date: s.date, data: s })),
    ...actions.map((a) => ({ kind: 'action' as const, date: a.date, data: a }))
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  if (events.length === 0)
    return <p className="py-10 text-center text-sm text-black/30">暂无记录。</p>

  return (
    <div className="relative pl-6">
      <div className="absolute left-[9px] top-1 bottom-1 w-px bg-black/10" />
      <div className="space-y-4">
        {events.map((e, i) => (
          <div key={i} className="relative">
            <div
              className={
                'absolute -left-[21px] top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ' +
                (e.kind === 'snap' ? 'bg-sky-500' : 'bg-etsy')
              }
            >
              {e.kind === 'snap' ? <Camera size={10} /> : <Wrench size={10} />}
            </div>
            <p className="text-xs font-medium text-black/40">{e.date}</p>
            {e.kind === 'snap' ? <SnapRow s={e.data} /> : <ActionRow a={e.data} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function SnapRow({ s }: { s: Snapshot }): JSX.Element {
  return (
    <div className="mt-1 rounded-lg border border-black/5 bg-white px-3 py-2 text-sm">
      <span className="mr-2 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-600">
        Snapshot
      </span>
      <span className="tabular-nums text-black/70">
        CTR {pct(ctr(s))} · CVR {pct(cvr(s))} · ROAS {s.roas != null ? num(s.roas, 2) : '—'} ·
        Orders {num((s.ads_orders ?? 0) + (s.organic_orders ?? 0))} · Rev{' '}
        {money((s.ads_revenue ?? 0) + (s.organic_revenue ?? 0))}
      </span>
    </div>
  )
}

function ActionRow({ a }: { a: Action }): JSX.Element {
  return (
    <div className="mt-1 rounded-lg border border-etsy/20 bg-etsy/5 px-3 py-2 text-sm">
      <span className="mr-2 rounded bg-etsy/15 px-1.5 py-0.5 text-[11px] font-medium text-etsy">
        {a.type}
      </span>
      <span className="font-medium">
        {a.ai_summary?.split('\n')[0].replace(/^Action:\s*/, '') || a.raw_text}
      </span>
      {(a.before || a.after) && (
        <span className="ml-1 text-black/50">
          {a.before} → {a.after}
        </span>
      )}
      {imageCount(a.images) > 0 && (
        <span className="ml-1 text-xs text-black/40">🖼 {imageCount(a.images)}</span>
      )}
    </div>
  )
}

function imageCount(images: string | null): number {
  if (!images) return 0
  try {
    const a = JSON.parse(images)
    return Array.isArray(a) ? a.length : 0
  } catch {
    return 0
  }
}
