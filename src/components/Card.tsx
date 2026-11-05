import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-surface border border-line p-4 shadow-[0_1px_2px_rgba(15,27,45,0.04)]', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[11px] font-semibold text-muted uppercase tracking-[0.08em]', className)} {...rest} />
}
