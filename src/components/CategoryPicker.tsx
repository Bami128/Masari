import type { Category } from '@/lib/types'
import { cn } from '@/lib/cn'
import { CategoryDot } from './CategoryDot'

export function CategoryPicker({
  categories,
  value,
  onChange,
  kind,
}: {
  categories: Category[]
  value: string | null
  onChange: (id: string | null) => void
  kind: 'expense' | 'income'
}) {
  const list = categories.filter((c) => c.kind === kind)
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => {
        const active = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? null : c.id)}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm border transition-colors',
              active ? 'border-accent bg-accent-soft text-accent-2 font-medium' : 'border-line-2 bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            <CategoryDot color={c.color} />
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
