import type { Category, Transaction } from '@/lib/types'
import { formatMinor } from '@/lib/money'
import { CategoryDot } from '@/components/CategoryDot'
import { cn } from '@/lib/cn'

export function TransactionRow({
  tx,
  category,
  homeCurrency,
  onClick,
}: {
  tx: Transaction
  category?: Category
  homeCurrency: string
  onClick?: () => void
}) {
  const isIncome = tx.type === 'income'
  const foreign = tx.currency !== homeCurrency
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-2 -mx-2 px-2 rounded-xl transition-colors"
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
        style={{ backgroundColor: `${category?.color ?? '#64748B'}22` }}
      >
        <CategoryDot color={category?.color} className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{tx.merchant || category?.name || (isIncome ? 'Income' : 'Expense')}</p>
        <p className="truncate text-xs text-muted">
          {category?.name ?? <span className="text-warn">Needs category</span>}
          {tx.note ? ` · ${tx.note}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-semibold tabular-nums', isIncome ? 'text-pos' : 'text-ink')}>
          {isIncome ? '+' : '−'}
          {formatMinor(tx.amount, tx.currency)}
        </p>
        {foreign && <p className="text-xs text-muted tabular-nums">≈ {formatMinor(tx.amount_home, homeCurrency)}</p>}
      </div>
    </button>
  )
}
