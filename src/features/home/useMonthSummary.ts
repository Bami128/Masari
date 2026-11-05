import { useMemo } from 'react'
import { useProfile } from '@/features/profile/useProfile'
import { useIncomeSources } from '@/features/income/useIncomeSources'
import { useMonthBudgets } from '@/features/budgets/useBudgets'
import { useMonthTransactions } from '@/features/transactions/useTransactions'
import { convertMinor } from '@/lib/money'
import { useFx } from '@/features/fx/FxProvider'
import { daysLeftInMonth } from '@/lib/dates'

/**
 * The "Summary" sheet, computed live for one month.
 *  income        = Σ active income sources (→ home currency), else profile.monthly_income
 *  planned       = overall budget line for the month, else profile.monthly_budget, else Σ category lines
 *  spent         = Σ expense transactions this month (home currency)
 *  received      = Σ income transactions this month
 *  left          = planned − spent
 *  shouldSave    = income − planned
 *  actualSaved   = income − spent        (the savings page can override this per month)
 *  pctOfIncome   = spent / income
 *  safeToday     = left ÷ days left in month (only for the current month)
 */
export function useMonthSummary(month: Date) {
  const { data: profile } = useProfile()
  const { data: sources = [], isLoading: l1 } = useIncomeSources()
  const { data: budgets = [], isLoading: l2 } = useMonthBudgets(month)
  const { data: txs = [], isLoading: l3 } = useMonthTransactions(month)

  const home = profile?.home_currency ?? 'QAR'
  const { rate, snapshot } = useFx()

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
    for (const t of txs) {
      if (t.type === 'expense') {
        spent += t.amount_home
        const k = t.category_id ?? '__none__'
        spentByCategory.set(k, (spentByCategory.get(k) ?? 0) + t.amount_home)
      } else if (t.type === 'income') received += t.amount_home
    }

    const now = new Date()
    const isCurrent = now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth()
    const left = planned - spent
    const safeToday = isCurrent && planned > 0 ? Math.max(0, Math.floor(left / daysLeftInMonth(now))) : null

    return {
      home,
      income,
      incomeSourceCount: active.length,
      planned,
      plannedIsFallback: overall === null,
      categoryPlanned,
      spent,
      received,
      left,
      shouldSave: income - planned,
      actualSaved: income - spent,
      pctOfIncome: income > 0 ? spent / income : null,
      pctOfPlanned: planned > 0 ? spent / planned : null,
      safeToday,
      spentByCategory,
      budgets,
      isCurrent,
      isLoading: l1 || l2 || l3,
    }
  }, [sources, budgets, txs, profile, home, month, l1, l2, l3, rate, snapshot])
}
