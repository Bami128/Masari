import { useMemo } from 'react'
import { useProfile } from '@/features/profile/useProfile'
import { useIncomeSources } from '@/features/income/useIncomeSources'
import { usePeriodBudgets } from '@/features/budgets/usePeriodBudgets'
import { useRangeTransactions } from '@/features/transactions/useRangeTransactions'
import { useCategories } from '@/features/categories/useCategories'
import { useFx } from '@/features/fx/FxProvider'
import { convertMinor } from '@/lib/money'
import type { Period, PeriodSnapshot, Transaction } from '@/lib/types'
import { expectedPeriodEnd } from './usePeriods'

/**
 * Live summary for one period (open or closed). For a closed period with a snapshot,
 * prefer `period.snapshot` for display — this hook recomputes from raw rows.
 */
export function usePeriodSummary(period: Period | null, previous: Period | null = null) {
  const { data: profile } = useProfile()
  const { data: sources = [], isLoading: l1 } = useIncomeSources()
  const { data: budgets = [], isLoading: l2 } = usePeriodBudgets(period?.id ?? null)
  const { data: categories = [] } = useCategories()
  const from = period ? new Date(period.started_at) : null
  const to = period?.closed_at ? new Date(period.closed_at) : null
  const { data: txs = [], isLoading: l3 } = useRangeTransactions(from, to)
  const { rate, snapshot: fx } = useFx()
  const home = profile?.home_currency ?? 'QAR'

  return useMemo(() => {
    const active = sources.filter((s) => s.is_active)
    const incomeFromSources = active.reduce((sum, s) => sum + convertMinor(s.amount, s.currency, home, rate(s.currency, home)), 0)
    const income = active.length > 0 ? incomeFromSources : (profile?.monthly_income ?? 0)

    const overall = budgets.find((b) => b.category_id === null)?.limit_amount ?? null
    const categoryLines = budgets.filter((b) => b.category_id !== null)
    const categoryPlanned = categoryLines.reduce((s, b) => s + b.limit_amount, 0)
    const planned = overall ?? profile?.monthly_budget ?? (categoryLines.length ? categoryPlanned : 0)

    let spent = 0
    let received = 0
    const spentByCategory = new Map<string, number>()
    const byMerchant = new Map<string, { spent: number; count: number }>()
    for (const t of txs) {
      if (t.type === 'expense') {
        spent += t.amount_home
        const k = t.category_id ?? '__none__'
        spentByCategory.set(k, (spentByCategory.get(k) ?? 0) + t.amount_home)
        const m = (t.merchant ?? '').trim().toLowerCase()
        if (m) {
          const cur = byMerchant.get(m) ?? { spent: 0, count: 0 }
          byMerchant.set(m, { spent: cur.spent + t.amount_home, count: cur.count + 1 })
        }
      } else if (t.type === 'income') received += t.amount_home
    }

    const now = new Date()
    const isOpen = Boolean(period && !period.closed_at)
    const start = period ? new Date(period.started_at) : now
    const end = period?.closed_at ? new Date(period.closed_at) : now
    const dayOf = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    const expectedEnd = period && isOpen ? expectedPeriodEnd(period, profile?.salary_day ?? null, previous) : null
    const daysLeft = expectedEnd ? Math.max(1, Math.ceil((expectedEnd.getTime() - now.getTime()) / 86400000)) : null
    const overdue = expectedEnd ? now > expectedEnd : false
    const left = planned - spent
    const safeToday = isOpen && planned > 0 && daysLeft ? Math.max(0, Math.floor(left / daysLeft)) : null

    // Which income number to use for "saved": actual received if any salary was logged, else the plan.
    const effectiveIncome = received > 0 ? received : income
    const actualSaved = period?.saved_override ?? effectiveIncome - spent

    const catById = new Map(categories.map((c) => [c.id, c]))
    const byCategory: PeriodSnapshot['by_category'] = [...spentByCategory.entries()]
      .map(([id, amt]) => {
        const line = categoryLines.find((b) => b.category_id === id)
        const c = id === '__none__' ? null : catById.get(id)
        return { category_id: id === '__none__' ? null : id, name: c?.name ?? 'Uncategorized', color: c?.color ?? '#94A3B8', spent: amt, planned: line?.limit_amount ?? null }
      })
      .sort((a, b) => b.spent - a.spent)
    // planned-but-unspent categories still belong in the snapshot
    for (const b of categoryLines) {
      if (b.category_id && !spentByCategory.has(b.category_id)) {
        const c = catById.get(b.category_id)
        byCategory.push({ category_id: b.category_id as string, name: c?.name ?? '—', color: c?.color ?? null, spent: 0, planned: b.limit_amount })
      }
    }
    const topMerchants = [...byMerchant.entries()]
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 8)

    return {
      home,
      period,
      isOpen,
      income,
      incomeSourceCount: active.length,
      planned,
      plannedIsFallback: overall === null,
      categoryPlanned,
      spent,
      received,
      left,
      shouldSave: income - planned,
      actualSaved,
      pctOfIncome: effectiveIncome > 0 ? spent / effectiveIncome : null,
      pctOfPlanned: planned > 0 ? spent / planned : null,
      safeToday,
      daysLeft,
      dayOf,
      expectedEnd,
      overdue,
      spentByCategory,
      byCategory,
      topMerchants,
      budgets,
      txs,
      txCount: txs.length,
      isLoading: l1 || l2 || l3,
    }
  }, [sources, budgets, txs, profile, home, period, previous, categories, rate, fx, l1, l2, l3])
}

export type PeriodSummary = ReturnType<typeof usePeriodSummary>

export function buildSnapshot(
  s: PeriodSummary,
  balances: Array<{ account: { id: string; name: string; currency: string }; balance: number }>,
  closedAt: Date,
): PeriodSnapshot {
  const start = new Date(s.period!.started_at)
  const effectiveIncome = s.received > 0 ? s.received : s.income
  return {
    home_currency: s.home,
    started_at: s.period!.started_at,
    closed_at: closedAt.toISOString(),
    days: Math.max(1, Math.ceil((closedAt.getTime() - start.getTime()) / 86400000)),
    tx_count: s.txCount,
    income: s.income,
    received: s.received,
    spent: s.spent,
    planned: s.planned,
    saved: effectiveIncome - s.spent,
    by_category: s.byCategory,
    top_merchants: s.topMerchants,
    balances: balances.map((b) => ({ account_id: b.account.id, name: b.account.name, currency: b.account.currency, balance: b.balance })),
  }
}

export function txsSpentBetween(txs: Transaction[], from: Date, to: Date): number {
  return txs.filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= from && new Date(t.occurred_at) < to).reduce((s, t) => s + t.amount_home, 0)
}
