import { cn } from '@/lib/cn'

export function CategoryDot({ color, className }: { color?: string | null; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', className)}
      style={{ backgroundColor: color ?? '#64748B' }}
    />
  )
}
