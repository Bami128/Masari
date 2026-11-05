import { cn } from '@/lib/cn'

/** The Masari mark — a stylized Arabic meem (م), first letter of مصاري. */
export function LogoMark({ className, tone = 'onDark' }: { className?: string; tone?: 'onDark' | 'onLight' }) {
  const head = tone === 'onDark' ? '#5B8DEF' : '#0F1B2D'
  const tail = tone === 'onDark' ? '#5B8DEF' : '#2F5BD6'
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="36" cy="22" r="10" fill="none" stroke={head} strokeWidth="7" />
      <path d="M36 32v14c0 4.5-3.5 8-8 8H14" fill="none" stroke={tail} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Navy rounded tile with the mark inside — app-icon style. */
export function LogoTile({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-14 w-14 rounded-2xl', lg: 'h-16 w-16 rounded-2xl' }[size]
  const mark = { sm: 'h-5 w-5', md: 'h-9 w-9', lg: 'h-10 w-10' }[size]
  return (
    <div className={cn('bg-hero flex items-center justify-center shrink-0', box, className)}>
      <LogoMark className={mark} />
    </div>
  )
}
