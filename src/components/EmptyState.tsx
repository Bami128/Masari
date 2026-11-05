import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-6">
      <div className="h-12 w-12 rounded-2xl bg-surface-2 flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted" />
      </div>
      <h3 className="font-medium text-ink">{title}</h3>
      {body && <p className="text-sm text-muted max-w-xs">{body}</p>}
      {action}
    </div>
  )
}
