import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function useToast(): (message: string, kind?: ToastKind) => void {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, kind === 'error' ? 6000 : 3000)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              'no-drag max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ' +
              (t.kind === 'error'
                ? 'bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-ink text-white')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
