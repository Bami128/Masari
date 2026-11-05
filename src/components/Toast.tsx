import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Toast = { id: number; message: string; kind: 'ok' | 'error' }
type Ctx = { toast: (message: string, kind?: Toast['kind']) => void }

const ToastContext = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, kind: Toast['kind'] = 'ok') => {
    const id = ++counter.current
    setItems((prev) => [...prev, { id, message, kind }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm shadow-lg border',
              t.kind === 'ok' ? 'bg-hero border-hero text-white' : 'bg-neg-soft border-neg/30 text-neg',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
