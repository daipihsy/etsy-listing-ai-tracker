import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export function Combobox({
  value,
  onChange,
  options,
  placeholder = '选择…',
  disabled,
  emptyHint,
  markStar
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  emptyHint?: string
  markStar?: (id: string) => boolean // 命中则前面加 ✨（用于标注可能支持视觉的模型）
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = q.trim()
    ? options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()))
    : options
  const exact = options.some((o) => o === q.trim())

  function pick(v: string): void {
    onChange(v)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={rootRef} className="no-drag relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-left text-sm outline-none focus:border-etsy disabled:opacity-50"
      >
        <span className={value ? '' : 'text-black/35'}>{value || placeholder}</span>
        <ChevronDown size={15} className="shrink-0 text-black/35" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
            <Search size={14} className="text-black/30" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索模型名…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && options.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-black/35">
                {emptyHint || '暂无模型，先点「获取模型」'}
              </p>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/5"
              >
                <span className="truncate">
                  {markStar?.(o) && <span className="mr-1">✨</span>}
                  {o}
                </span>
                {value === o && <Check size={14} className="shrink-0 text-etsy" />}
              </button>
            ))}
            {/* 允许使用未在列表中的自定义模型名 */}
            {q.trim() && !exact && (
              <button
                type="button"
                onClick={() => pick(q.trim())}
                className="flex w-full items-center gap-2 border-t border-black/5 px-3 py-1.5 text-left text-sm text-etsy hover:bg-etsy/5"
              >
                使用自定义：“{q.trim()}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
