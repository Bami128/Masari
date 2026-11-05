import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardTitle } from '@/components/Card'
import { Segmented } from '@/components/Field'
import { EmptyState } from '@/components/EmptyState'
import { MoneyInput } from '@/components/MoneyInput'
import { CategoryDot } from '@/components/CategoryDot'
import { formatMinor, fromMinor, convertMinor } from '@/lib/money'
import { useFx } from '@/features/fx/FxProvider'
import { monthsOfYear, monthStartKey, shortMonth } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { useProfile } from '@/features/profile/useProfile'
import { useCategories } from '@/features/categories/useCategories'
import { useIncomeSources } from '@/features/income/useIncomeSources'
import { useYearBudgets } from '@/features/budgets/useBudgets'
import { useYearTransactions } from '@/features/transactions/useYearTransactions'
import { useSetSavings, useYearSavings } from '@/features/savings/useSavings'

type Tab = 'year' | 'savings'

export function ReportsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [tab, setTab] = useState<Tab>('year')
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const { data: sources = [] } = useIncomeSources()
  const { data: budgets = [] } = useYearBudgets(year)
  const { data: txs = [], isLoading } = useYearTransactions(year)
  const { data: savings = [] } = useYearSavings(year)
  const setSavings = useSetSavings()
  const { rate, snapshot } = useFx()

  const home = profile?.home_currency ?? 'QAR'
  const months = useMemo(() => monthsOfYear(year), [year])
  const now = new Date()
  const currentIdx = now.getFullYear() === year ? now.getMonth() : now.getFullYear() > year ? 11 : -1

  // spent[catId][monthIdx], received[monthIdx]
  const grid = useMemo(() => {
    const spent = new Map<string, number[]>()
    const received = Array(12).fill(0) as number[]
    const totalSpent = Array(12).fill(0) as number[]
    for (const t of txs) {
      const m = new Date(t.occurred_at).getMonth()
      if (t.type === 'income') {
        received[m] += t.amount_home
        continue
      }
      if (t.type !== 'expense') continue
      const k = t.category_id ?? '__none__'
      if (!spent.has(k)) spent.set(k, Array(12).fill(0))
      spent.get(k)![m] += t.amount_home
      totalSpent[m] += t.amount_home
    }
    return { spent, received, totalSpent }
  }, [txs])

  const monthlyIncome = useMemo(() => {
    const active = sources.filter((s) => s.is_active)
    if (active.length === 0) return profile?.monthly_income ?? 0
    return active.reduce((sum, s) => sum + convertMinor(s.amount, s.currency, home, rate(s.currency, home)), 0)
  }, [sources, profile, home, rate, snapshot])

  const plannedByMonth = useMemo(() => {
    return months.map((m) => {
      const key = monthStartKey(m)
      const lines = budgets.filter((b) => b.month === key)
      const overall = lines.find((b) => b.category_id === null)?.limit_amount
      if (overall != null) return overall
      if (profile?.monthly_budget) return profile.monthly_budget
      return lines.reduce((s, b) => s + b.limit_amount, 0)
    })
  }, [months, budgets, profile])

  const savingsByMonth = useMemo(() => {
    const override = new Map(savings.map((s) => [s.month, s.amount]))
    return months.map((m, i) => {
      const key = monthStartKey(m)
      const auto = monthlyIncome - grid.totalSpent[i]
      const manual = override.get(key) ?? null
      const elapsed = i <= currentIdx
      // A past month with no transactions and no override is "no data", not "saved everything".
      const hasData = manual !== null || grid.totalSpent[i] > 0 || grid.received[i] > 0
      return { key, auto, manual, value: manual ?? auto, elapsed, hasData }
    })
  }, [months, savings, monthlyIncome, grid.totalSpent, grid.received, currentIdx])

  const chartData = useMemo(() => {
    let forecast = 0
    let actual = 0
    return months.map((m, i) => {
      forecast += monthlyIncome - plannedByMonth[i]
      const row: { name: string; forecast: number; actual?: number } = { name: shortMonth(m), forecast: fromMinor(forecast, home) }
      if (savingsByMonth[i].elapsed && savingsByMonth[i].hasData) {
        actual += savingsByMonth[i].value
        row.actual = fromMinor(actual, home)
      }
      return row
    })
  }, [months, monthlyIncome, plannedByMonth, savingsByMonth, home])

  const catRows = useMemo(() => {
    const rows = categories
      .filter((c) => c.kind === 'expense')
      .map((c) => ({ id: c.id, name: c.name, color: c.color, cells: grid.spent.get(c.id) ?? (Array(12).fill(0) as number[]) }))
      .filter((r) => r.cells.some((v) => v > 0))
    if (grid.spent.has('__none__')) rows.push({ id: '__none__', name: 'Uncategorized', color: '#94A3B8', cells: grid.spent.get('__none__')! })
    return rows.map((r) => ({ ...r, total: r.cells.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total)
  }, [categories, grid.spent])

  const yearTotals = {
    spent: grid.totalSpent.reduce((a, b) => a + b, 0),
    received: grid.received.reduce((a, b) => a + b, 0),
    saved: savingsByMonth.filter((s) => s.elapsed && s.hasData).reduce((a, s) => a + s.value, 0),
  }

  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gridRef.current
    if (!el || currentIdx < 0 || tab !== 'year') return
    const th = el.querySelectorAll('thead th')[currentIdx + 1] as HTMLElement | undefined
    if (th) el.scrollLeft = Math.max(0, th.offsetLeft - 160)
  }, [currentIdx, tab, catRows.length])

  const fmt = (v: number) => (v === 0 ? <span className="text-muted-2">·</span> : formatMinor(v, home, { compact: true }).replace(/^[A-Z]{3}\s?/, ''))

  return (
    <>
      <PageHeader
        title="Reports"
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setYear((y) => y - 1)} className="h-9 w-9 rounded-lg hover:bg-surface-2 flex items-center justify-center" aria-label="Previous year">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium w-12 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="h-9 w-9 rounded-lg hover:bg-surface-2 flex items-center justify-center" aria-label="Next year">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        }
      />

      <div className="mb-4 max-w-xs">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'year', label: 'Year grid' },
            { value: 'savings', label: 'Savings' },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3">
          <CardTitle>Spent</CardTitle>
          <p className="mt-1 font-semibold tabular-nums">{formatMinor(yearTotals.spent, home, { compact: true })}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Received</CardTitle>
          <p className="mt-1 font-semibold tabular-nums text-pos">{formatMinor(yearTotals.received, home, { compact: true })}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Saved so far</CardTitle>
          <p className={cn('mt-1 font-semibold tabular-nums', yearTotals.saved < 0 && 'text-neg')}>{monthlyIncome > 0 ? formatMinor(yearTotals.saved, home, { compact: true }) : '—'}</p>
        </Card>
      </div>

      {tab === 'year' ? (
        <Card className="p-0 overflow-hidden">
          {!isLoading && catRows.length === 0 ? (
            <EmptyState icon={PieIcon} title={`Nothing in ${year}`} body="Log a few transactions and the category × month grid fills in here." />
          ) : (
            <div className="overflow-x-auto" ref={gridRef}>
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted border-b border-line">
                    <th className="text-left font-medium px-3 py-2.5 sticky left-0 bg-surface min-w-36">Category</th>
                    {months.map((m, i) => (
                      <th key={i} className={cn('font-medium px-2 py-2.5 text-right min-w-14', i === currentIdx && 'text-accent')}>
                        {shortMonth(m)}
                      </th>
                    ))}
                    <th className="font-semibold px-3 py-2.5 text-right min-w-20 text-ink">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {catRows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2/60">
                      <td className="px-3 py-2 sticky left-0 bg-surface">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <CategoryDot color={r.color} />
                          <span className="truncate">{r.name}</span>
                        </span>
                      </td>
                      {r.cells.map((v, i) => (
                        <td key={i} className={cn('px-2 py-2 text-right', i === currentIdx && 'bg-accent-soft/50')}>
                          {fmt(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line-2 bg-surface-2/40">
                  <tr className="font-semibold">
                    <td className="px-3 py-2 sticky left-0 bg-surface-2">Spent</td>
                    {grid.totalSpent.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right">{fmt(v)}</td>
                    ))}
                    <td className="px-3 py-2 text-right">{fmt(yearTotals.spent)}</td>
                  </tr>
                  <tr className="text-muted">
                    <td className="px-3 py-2 sticky left-0 bg-surface-2">Planned</td>
                    {plannedByMonth.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right">{fmt(v)}</td>
                    ))}
                    <td className="px-3 py-2 text-right">{fmt(plannedByMonth.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                  <tr className="text-pos">
                    <td className="px-3 py-2 sticky left-0 bg-surface-2">Received</td>
                    {grid.received.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right">{fmt(v)}</td>
                    ))}
                    <td className="px-3 py-2 text-right">{fmt(yearTotals.received)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle>Savings — forecast vs actual</CardTitle>
            <p className="text-xs text-muted mt-0.5">Forecast = cumulative (income − planned). Actual = cumulative (income − spent), or your override.</p>
            {monthlyIncome <= 0 ? (
              <p className="mt-4 text-sm text-muted">Add an income source on the Budget page to see this.</p>
            ) : (
              <div className="mt-4 h-56 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E9EF" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip
                      formatter={(v) => formatMinor(Math.round(Number(v) * 100), home)}
                      contentStyle={{ borderRadius: 12, border: '1px solid #E5E9EF', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#94A3B8" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="#2F5BD6" dot={{ r: 3 }} strokeWidth={2.5} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="mt-4 p-0 overflow-hidden">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted border-b border-line">
                  <th className="text-left font-medium px-4 py-2.5">Month</th>
                  <th className="text-right font-medium px-2 py-2.5">Income</th>
                  <th className="text-right font-medium px-2 py-2.5">Spent</th>
                  <th className="text-right font-medium px-4 py-2.5 w-32">Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {months.map((m, i) => {
                  const row = savingsByMonth[i]
                  return (
                    <tr key={i} className={cn(!row.elapsed && 'text-muted-2', i === currentIdx && 'bg-accent-soft/40')}>
                      <td className="px-4 py-2 font-medium">{shortMonth(m)}</td>
                      <td className="px-2 py-2 text-right">{row.elapsed && row.hasData ? fmt(monthlyIncome) : '·'}</td>
                      <td className="px-2 py-2 text-right">{row.elapsed && row.hasData ? fmt(grid.totalSpent[i]) : '·'}</td>
                      <td className="px-4 py-2 text-right">
                        {row.elapsed ? (
                          <MoneyInput
                            valueMinor={row.manual}
                            currency={home}
                            placeholder={monthlyIncome > 0 && row.hasData ? String(fromMinor(row.auto, home)) : '—'}
                            onCommit={(v) => setSavings.mutate({ month: m, amount: v })}
                            className={cn(row.manual === null && 'text-muted')}
                          />
                        ) : (
                          '·'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted border-t border-line">Saved is auto-calculated (income − spent). Type a number to override it — e.g. what you actually moved to savings.</p>
          </Card>
        </>
      )}
    </>
  )
}
