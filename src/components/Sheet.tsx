import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

// Bottom sheet on phones, centered dialog on desktop.
export function Sheet({ open, onClose, title, children, className }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-end md:items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full md:max-w-lg bg-surface rounded-t-3xl md:rounded-2xl shadow-2xl',
          'max-h-[92dvh] flex flex-col safe-bottom',
          className,
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-line-2" />
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink p-1 -mr-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
