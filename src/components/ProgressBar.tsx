import { cn } from '@/lib/cn'

export function ProgressBar({
  value,
  max,
  className,
  tone = 'auto',
  onDark = false,
}: {
  value: number
  max: number
  className?: string
  tone?: 'auto' | 'accent' | 'pos' | 'neg' | 'warn'
  onDark?: boolean
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const auto = pct >= 100 ? 'neg' : pct >= 85 ? 'warn' : 'accent'
  const t = tone === 'auto' ? auto : tone
  const fill = { accent: onDark ? 'bg-hero-bar' : 'bg-accent', pos: 'bg-pos', neg: 'bg-neg', warn: 'bg-warn' }[t]
  return (
    <div className={cn('h-2 rounded-full overflow-hidden', onDark ? 'bg-hero-2' : 'bg-surface-3', className)}>
      <div className={cn('h-full rounded-full transition-[width]', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}
