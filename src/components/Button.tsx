import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-hero text-white hover:bg-hero-2 active:bg-hero font-semibold shadow-sm',
  secondary: 'bg-surface text-ink hover:bg-surface-2 border border-line-2 font-medium',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2',
  danger: 'bg-neg text-white hover:opacity-90 font-semibold',
}

const sizes: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-13 px-5 text-base rounded-2xl gap-2.5',
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center transition-colors select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
