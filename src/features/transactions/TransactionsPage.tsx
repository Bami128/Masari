import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, List, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'
import { Input } from '@/components/Field'
import { Spinner } from '@/components/Spinner'
import { formatMinor } from '@/lib/money'
import { dayLabel, monthLabel, shiftMonth } from '@/lib/dates'
import { useProfile } from '@/features/profile/useProfile'
import { useCategories } from '@/features/categories/useCategories'
import { useQuickAdd } from '@/features/quickadd/QuickAddContext'
import { useMonthTransactions } from './useTransactions'
import { TransactionRow } from './TransactionRow'

export function TransactionsPage() {
  const [month, setMonth] = useState(() => new Date())
  const [q, setQ] = useState('')
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const { data: txs = [], isLoading } = useMonthTransactions(month)
  const { openQuick, openEdit } = useQuickAdd()
  const home = profile?.home_currency ?? 'QAR'

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return txs
    return txs.filter((t) => {
      const cat = t.category_id ? catById.get(t.category_id)?.name ?? '' : ''
      return [t.merchant ?? '', t.note ?? '', cat].some((s) => s.toLowerCase().includes(needle))
    })
  }, [txs, q, catById])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const t of filtered) {
      const key = new Date(t.occurred_at).toDateString()
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }
    return [...map.entries()]
  }, [filtered])

  const totals = useMemo(() => {
    let out = 0
    let inc = 0
    for (const t of filtered) {
      if (t.type === 'expense') out += t.amount_home
      else if (t.type === 'income') inc += t.amount_home
    }
    return { out, inc }
  }, [filtered])

  return (
    <>
      <PageHeader
        title="Transactions"
        action={
          <Button size="sm" onClick={openQuick}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="h-10 w-10 rounded-xl hover:bg-surface-2 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-medium">{monthLabel(month)}</span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="h-10 w-10 rounded-xl hover:bg-surface-2 flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input placeholder="Search merchant, note, category" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-3">
            <p className="text-xs text-muted">Spent</p>
            <p className="font-semibold tabular-nums">{formatMinor(totals.out, home)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted">Received</p>
            <p className="font-semibold tabular-nums text-pos">{formatMinor(totals.inc, home)}</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={List}
            title={q ? 'Nothing matches' : `Nothing in ${monthLabel(month)}`}
            body={q ? undefined : 'Tap + and type something like "coffee 15".'}
            action={!q ? <Button size="sm" onClick={openQuick}>Add one</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([key, items]) => {
            const d = new Date(key)
            const dayOut = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount_home, 0)
            return (
              <Card key={key} className="py-2">
                <div className="flex items-center justify-between px-0 py-1.5">
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">{dayLabel(d)}</span>
                  {dayOut > 0 && <span className="text-xs text-muted tabular-nums">−{formatMinor(dayOut, home)}</span>}
                </div>
                <div className="divide-y divide-line">
                  {items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      tx={t}
                      category={t.category_id ? catById.get(t.category_id) : undefined}
                      homeCurrency={home}
                      onClick={() => openEdit(t)}
                    />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
