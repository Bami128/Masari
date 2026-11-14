import { useMutation } from '@tanstack/react-query'
import { useIncomeSources } from '@/features/income/useIncomeSources'
import { useAccounts } from '@/features/accounts/useAccounts'
import { useCategories } from '@/features/categories/useCategories'
import { useProfile } from '@/features/profile/useProfile'
import { useCreateTransaction } from '@/features/transactions/useTransactions'
import { useFx } from '@/features/fx/FxProvider'
import { convertMinor } from '@/lib/money'

/** Logs every active income source as an income transaction dated now. */
export function useLogSalary() {
  const { data: sources = [] } = useIncomeSources()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: profile } = useProfile()
  const create = useCreateTransaction()
  const { rate } = useFx()
  const home = profile?.home_currency ?? 'QAR'
  const active = sources.filter((s) => s.is_active && s.amount > 0)

  const mutation = useMutation({
    mutationFn: async () => {
      const salaryCat = categories.find((c) => c.kind === 'income' && /salary/i.test(c.name)) ?? categories.find((c) => c.kind === 'income') ?? null
      const def = accounts.find((a) => a.is_default && !a.is_archived) ?? accounts.find((a) => !a.is_archived) ?? null
      for (const s of active) {
        const acct = accounts.find((a) => !a.is_archived && a.currency === s.currency) ?? def
        await create.mutateAsync({
          type: 'income',
          amount: s.amount,
          currency: s.currency,
          amount_home: convertMinor(s.amount, s.currency, home, rate(s.currency, home)),
          fx_rate: rate(s.currency, home),
          merchant: s.name,
          note: null,
          category_id: salaryCat?.id ?? null,
          account_id: acct?.id ?? null,
          occurred_at: new Date().toISOString(),
          source: 'manual',
        })
      }
      return active.length
    },
  })

  return { ...mutation, sources: active }
}
