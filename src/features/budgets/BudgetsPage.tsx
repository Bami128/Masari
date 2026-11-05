import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input, Select } from '@/components/Field'
import { MoneyInput } from '@/components/MoneyInput'
import { ProgressBar } from '@/components/ProgressBar'
import { CategoryDot } from '@/components/CategoryDot'
import { useToast } from '@/components/Toast'
import { CURRENCIES } from '@/lib/types'
import { formatMinor, toMinor } from '@/lib/money'
import { monthLabel, shiftMonth } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { useCategories } from '@/features/categories/useCategories'
import { useMonthSummary } from '@/features/home/useMonthSummary'
import { useCopyBudgets, useSetBudget } from './useBudgets'
import { useCreateIncomeSource, useDeleteIncomeSource, useIncomeSources, useUpdateIncomeSource } from '@/features/income/useIncomeSources'

export function BudgetsPage() {
  const [month, setMonth] = useState(() => new Date())
  const s = useMonthSummary(month)
  const { data: categories = [] } = useCategories()
  const setBudget = useSetBudget()
  const copy = useCopyBudgets()
  const { toast } = useToast()

  const expenseCats = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories])
  const lineByCat = useMemo(() => new Map(s.budgets.filter((b) => b.category_id).map((b) => [b.category_id as string, b])), [s.budgets])
  const overallLine = s.budgets.find((b) => b.category_id === null) ?? null
  const hasLines = s.budgets.length > 0

  const commit = async (category_id: string | null, minor: number | null) => {
    try {
      await setBudget.mutateAsync({ month, category_id, limit_amount: minor })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  const copyPrev = async () => {
    try {
      const n = await copy.mutateAsync({ from: shiftMonth(month, -1), to: month })
      toast(n ? `Copied ${n} line${n > 1 ? 's' : ''} from ${monthLabel(shiftMonth(month, -1))}` : 'Nothing to copy from last month')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not copy', 'error')
    }
  }

  // Rows: every expense category, with its planned line (if any) and spent.
  const rows = expenseCats.map((c) => {
    const line = lineByCat.get(c.id)
    const spent = s.spentByCategory.get(c.id) ?? 0
    return { cat: c, planned: line?.limit_amount ?? null, spent }
  })
  const uncategorized = s.spentByCategory.get('__none__') ?? 0

  return (
    <>
      <PageHeader
        title="Budget"
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-9 w-9 rounded-lg hover:bg-surface-2 flex items-center justify-center" aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium min-w-28 text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="h-9 w-9 rounded-lg hover:bg-surface-2 flex items-center justify-center" aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3">
          <CardTitle>Income</CardTitle>
          <p className="mt-1 font-semibold tabular-nums">{s.income > 0 ? formatMinor(s.income, s.home, { compact: true }) : '—'}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Planned</CardTitle>
          <p className="mt-1 font-semibold tabular-nums">{s.planned > 0 ? formatMinor(s.planned, s.home, { compact: true }) : '—'}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Should save</CardTitle>
          <p className={cn('mt-1 font-semibold tabular-nums', s.income > 0 && (s.shouldSave >= 0 ? 'text-pos' : 'text-neg'))}>
            {s.income > 0 ? formatMinor(s.shouldSave, s.home, { compact: true }) : '—'}
          </p>
        </Card>
      </div>

      <IncomeCard home={s.home} />

      {/* Expenses plan */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Planned expenses</CardTitle>
            <p className="text-xs text-muted mt-0.5">Planned · Spent · Left</p>
          </div>
          {!hasLines && (
            <Button size="sm" variant="secondary" onClick={copyPrev} disabled={copy.isPending}>
              <Copy className="h-4 w-4" /> Copy last month
            </Button>
          )}
        </div>

        {/* Overall */}
        <div className="mt-4 rounded-xl bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Overall monthly budget</p>
              <p className="text-xs text-muted">{overallLine ? 'For this month' : s.plannedIsFallback && s.planned > 0 ? 'Using your default from Settings' : 'Leave empty to use the category total'}</p>
            </div>
            <div className="w-32">
              <MoneyInput valueMinor={overallLine?.limit_amount ?? null} currency={s.home} onCommit={(v) => commit(null, v)} placeholder={s.planned > 0 && !overallLine ? String(s.planned / 100) : '—'} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>{formatMinor(s.spent, s.home)} spent</span>
            <span className={cn('font-medium', s.left < 0 ? 'text-neg' : 'text-pos')}>{formatMinor(s.left, s.home)} left</span>
          </div>
          <ProgressBar value={s.spent} max={s.planned} className="mt-1.5 h-1.5" />
        </div>

        {/* Category lines */}
        <div className="mt-2 divide-y divide-line">
          {rows.map(({ cat, planned, spent }) => {
            const left = planned !== null ? planned - spent : null
            return (
              <div key={cat.id} className="py-3">
                <div className="flex items-center gap-3">
                  <CategoryDot color={cat.color} className="h-2.5 w-2.5" />
                  <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                  <div className="w-28">
                    <MoneyInput valueMinor={planned} currency={s.home} onCommit={(v) => commit(cat.id, v)} />
                  </div>
                </div>
                <div className="mt-2 pl-[1.375rem] flex items-center gap-3">
                  <ProgressBar value={spent} max={planned ?? 0} className="flex-1 h-1.5" tone={planned === null ? 'accent' : 'auto'} />
                  <span className="text-xs tabular-nums text-muted w-36 text-right">
                    <span className={cn(planned !== null && spent > planned ? 'text-neg font-medium' : 'text-ink')}>{formatMinor(spent, s.home, { compact: true })}</span>
                    {left !== null && <> · {left < 0 ? '−' : ''}{formatMinor(Math.abs(left), s.home, { compact: true })} left</>}
                  </span>
                </div>
              </div>
            )
          })}
          {uncategorized > 0 && (
            <div className="py-3 flex items-center gap-3 text-sm">
              <CategoryDot color="#94A3B8" className="h-2.5 w-2.5" />
              <span className="flex-1 text-muted">Uncategorized</span>
              <span className="tabular-nums text-warn font-medium">{formatMinor(uncategorized, s.home, { compact: true })}</span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-3 border-t border-line-2 flex items-center justify-between text-sm">
          <span className="font-medium">Category total</span>
          <span className="tabular-nums">
            <span className="text-muted">{formatMinor(s.spent, s.home, { compact: true })} spent · </span>
            <span className="font-semibold">{formatMinor(s.categoryPlanned, s.home, { compact: true })} planned</span>
          </span>
        </div>
      </Card>
    </>
  )
}

function IncomeCard({ home }: { home: string }) {
  const { data: sources = [] } = useIncomeSources()
  const create = useCreateIncomeSource()
  const update = useUpdateIncomeSource()
  const remove = useDeleteIncomeSource()
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)

  const add = async () => {
    const n = Number(amount.replace(/,/g, ''))
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return toast('Name and amount needed', 'error')
    try {
      await create.mutateAsync({ name: name.trim(), amount: toMinor(n, currency), currency })
      setName('')
      setAmount('')
      setAdding(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add', 'error')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Monthly income</CardTitle>
          <p className="text-xs text-muted mt-0.5">Salary and anything else that comes in every month</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {adding && (
        <div className="mt-3 rounded-xl border border-line p-3 grid gap-3 grid-cols-[1fr_6rem_5rem] items-end">
          <Input placeholder="e.g. Salary" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-10 text-sm col-span-3 sm:col-span-1" />
          <Input inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 text-sm" />
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 text-sm">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <div className="col-span-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} disabled={create.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}

      {sources.length === 0 && !adding ? (
        <p className="mt-3 text-sm text-muted">No income sources yet — add your salary to unlock "should save" and the savings tracker.</p>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {sources.map((src) => (
            <div key={src.id} className={cn('py-2.5 flex items-center gap-3', !src.is_active && 'opacity-50')}>
              <input
                type="checkbox"
                checked={src.is_active}
                onChange={(e) => update.mutate({ id: src.id, is_active: e.target.checked })}
                className="h-4 w-4 accent-[#2F5BD6]"
                aria-label={`${src.name} active`}
              />
              <span className="flex-1 text-sm truncate">{src.name}</span>
              <div className="w-28">
                <MoneyInput valueMinor={src.amount} currency={src.currency} onCommit={(v) => v !== null && update.mutate({ id: src.id, amount: v })} />
              </div>
              <span className="text-xs text-muted w-9">{src.currency}</span>
              <button onClick={() => remove.mutate(src.id)} className="text-muted hover:text-neg p-1" aria-label={`Delete ${src.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
