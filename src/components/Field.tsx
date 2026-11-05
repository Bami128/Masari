import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const base =
  'w-full rounded-xl bg-surface border border-line-2 px-4 text-base text-ink placeholder:text-muted-2 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-60'

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-sm font-medium text-ink-2">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(base, 'h-12', className)} {...rest} />
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cn(base, 'h-12 appearance-none', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(base, 'py-3 min-h-20', className)} {...rest} />
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div className="grid rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 rounded-lg text-sm font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
