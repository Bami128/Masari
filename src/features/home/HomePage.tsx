import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Settings, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/features/auth/AuthProvider'
import { Card, CardTitle } from '@/components/Card'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'
import { ProgressBar } from '@/components/ProgressBar'
import { formatMinor } from '@/lib/money'
import { daysLeftInMonth } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { useProfile } from '@/features/profile/useProfile'
import { useCategories } from '@/features/categories/useCategories'
import { useRecentTransactions } from '@/features/transactions/useTransactions'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { useQuickAdd } from '@/features/quickadd/QuickAddContext'
import { useMonthSummary } from './useMonthSummary'
import { AccountsCard } from '@/features/accounts/AccountsCard'

export function HomePage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const { data: recent = [] } = useRecentTransactions(5)
  const { openQuick, openEdit } = useQuickAdd()
  const now = new Date()
  const s = useMonthSummary(now)

  const firstName =
    profile?.display_name?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    'there'
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const topCategories = useMemo(() => {
    const lines = s.budgets.filter((b) => b.category_id !== null)
    const rows = lines.map((b) => ({
      id: b.category_id as string,
      name: catById.get(b.category_id as string)?.name ?? '—',
      color: catById.get(b.category_id as string)?.color ?? null,
      planned: b.limit_amount,
      spent: s.spentByCategory.get(b.category_id as string) ?? 0,
    }))
    rows.sort((a, b) => b.spent / Math.max(1, b.planned) - a.spent / Math.max(1, a.planned))
    return rows.slice(0, 5)
  }, [s.budgets, s.spentByCategory, catById])

  const hasPlan = s.planned > 0

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={`${format(now, 'MMMM')} · ${daysLeftInMonth(now)} days left`}
        action={
          <Link to="/settings" aria-label="Settings" className="md:hidden h-10 w-10 rounded-xl bg-surface border border-line flex items-center justify-center text-ink-2">
            <Settings className="h-5 w-5" />
          </Link>
        }
      />

      {/* Hero */}
      <div className="rounded-2xl bg-hero text-white p-5 shadow-lg shadow-hero/15">
        {hasPlan ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Left to spend this month</p>
            <p className={cn('mt-1.5 text-4xl font-semibold tracking-tight tabular-nums', s.left < 0 && 'text-red-300')}>
              {formatMinor(s.left, s.home)}
            </p>
            <ProgressBar value={s.spent} max={s.planned} onDark className="mt-4" />
            <div className="mt-2.5 flex items-center justify-between text-sm text-white/75">
              <span>
                {formatMinor(s.spent, s.home, { compact: true })} spent of {formatMinor(s.planned, s.home, { compact: true })}
              </span>
              <span className={cn('font-medium', s.left < 0 ? 'text-red-300' : s.pctOfPlanned !== null && s.pctOfPlanned > 0.85 ? 'text-amber-300' : 'text-emerald-300')}>
                {s.left < 0 ? 'Over budget' : s.pctOfPlanned !== null && s.pctOfPlanned > 0.85 ? 'Getting close' : 'On track'}
              </span>
            </div>
            {s.safeToday !== null && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between">
                <span className="text-sm text-white/75">Safe to spend today</span>
                <span className="text-xl font-semibold tabular-nums">{formatMinor(s.safeToday, s.home)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Spent this month</p>
            <p className="mt-1.5 text-4xl font-semibold tracking-tight tabular-nums">{formatMinor(s.spent, s.home)}</p>
            <p className="mt-3 text-sm text-white/75">
              Set a monthly budget to see how much you have left.{' '}
              <Link to="/budgets" className="text-white underline underline-offset-2">
                Set it up
              </Link>
            </p>
          </>
        )}
      </div>

      <div className="mt-4">
        <AccountsCard />
      </div>

      {/* Summary tiles — the Excel "Summary" sheet */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <CardTitle>Income</CardTitle>
          <p className="mt-1 text-lg font-semibold tabular-nums">{s.income > 0 ? formatMinor(s.income, s.home, { compact: true }) : '—'}</p>
          <p className="text-xs text-muted">{s.incomeSourceCount > 0 ? `${s.incomeSourceCount} source${s.incomeSourceCount > 1 ? 's' : ''}` : 'add in Budget'}</p>
        </Card>
        <Card className="p-3.5">
          <CardTitle>Planned expenses</CardTitle>
          <p className="mt-1 text-lg font-semibold tabular-nums">{s.planned > 0 ? formatMinor(s.planned, s.home, { compact: true }) : '—'}</p>
          <p className="text-xs text-muted">{s.categoryPlanned > 0 ? `${formatMinor(s.categoryPlanned, s.home, { compact: true })} across categories` : 'per month'}</p>
        </Card>
        <Card className="p-3.5">
          <CardTitle>Should save</CardTitle>
          <p className={cn('mt-1 text-lg font-semibold tabular-nums', s.income > 0 && (s.shouldSave >= 0 ? 'text-pos' : 'text-neg'))}>
            {s.income > 0 ? formatMinor(s.shouldSave, s.home, { compact: true }) : '—'}
          </p>
          <p className="text-xs text-muted">income − planned</p>
        </Card>
        <Card className="p-3.5">
          <CardTitle>Of income spent</CardTitle>
          <p className={cn('mt-1 text-lg font-semibold tabular-nums', s.pctOfIncome !== null && s.pctOfIncome > 1 && 'text-neg')}>
            {s.pctOfIncome !== null ? `${Math.round(s.pctOfIncome * 100)}%` : '—'}
          </p>
          {s.pctOfIncome !== null ? <ProgressBar value={s.spent} max={s.income} className="mt-2 h-1.5" /> : <p className="text-xs text-muted">needs income</p>}
        </Card>
      </div>

      {/* Category progress */}
      {topCategories.length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Categories</CardTitle>
            <Link to="/budgets" className="text-xs text-accent inline-flex items-center gap-1 font-medium">
              Budget <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {topCategories.map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? '#64748B' }} />
                    {c.name}
                  </span>
                  <span className="tabular-nums text-muted">
                    <span className={cn('font-medium', c.spent > c.planned ? 'text-neg' : 'text-ink')}>{formatMinor(c.spent, s.home, { compact: true })}</span> / {formatMinor(c.planned, s.home, { compact: true })}
                  </span>
                </div>
                <ProgressBar value={c.spent} max={c.planned} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent */}
      <Card className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <CardTitle>Recent</CardTitle>
          {recent.length > 0 && (
            <Link to="/transactions" className="text-xs text-accent inline-flex items-center gap-1 font-medium">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No transactions yet"
            body={'Tap + and type something like "coffee 15". That\'s it.'}
            action={<Button size="sm" onClick={openQuick}>Add your first</Button>}
          />
        ) : (
          <div className="divide-y divide-line">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} category={t.category_id ? catById.get(t.category_id) : undefined} homeCurrency={s.home} onClick={() => openEdit(t)} />
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
