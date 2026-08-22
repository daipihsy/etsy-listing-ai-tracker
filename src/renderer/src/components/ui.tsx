import { type ReactNode, type ButtonHTMLAttributes, useEffect } from 'react'
import { X } from 'lucide-react'

export function Spinner({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  loading?: boolean
}
export function Button({
  variant = 'primary',
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: BtnProps): JSX.Element {
  const base =
    'no-drag inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-etsy text-white hover:brightness-95',
    ghost: 'bg-transparent text-ink hover:bg-black/5',
    subtle: 'bg-black/5 text-ink hover:bg-black/10',
    danger: 'bg-red-600 text-white hover:brightness-95'
  }[variant]
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}): JSX.Element {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="no-drag fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-black/40 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: string
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-black/60">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/40">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'no-drag w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-etsy focus:ring-1 focus:ring-etsy'
