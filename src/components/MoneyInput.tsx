import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { fromMinor, toMinor } from '@/lib/money'

/** Edits a minor-unit integer as a human number. Commits on blur / Enter. Empty = null. */
export function MoneyInput({
  valueMinor,
  currency,
  onCommit,
  placeholder = '—',
  className,
  align = 'right',
}: {
  valueMinor: number | null
  currency: string
  onCommit: (minor: number | null) => void
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
}) {
  const toText = (v: number | null) => (v === null ? '' : String(fromMinor(v, currency)))
  const [text, setText] = useState(toText(valueMinor))

  useEffect(() => {
    setText(toText(valueMinor))
  }, [valueMinor, currency]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const trimmed = text.trim().replace(/,/g, '')
    if (trimmed === '') {
      if (valueMinor !== null) onCommit(null)
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      setText(toText(valueMinor))
      return
    }
    const minor = toMinor(n, currency)
    if (minor !== valueMinor) onCommit(minor)
  }

  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(toText(valueMinor))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={cn(
        'h-9 w-full rounded-lg bg-surface-2 border border-transparent px-2.5 text-sm tabular-nums text-ink',
        'hover:border-line-2 focus:bg-surface focus:border-accent focus:outline-none placeholder:text-muted-2',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    />
  )
}
