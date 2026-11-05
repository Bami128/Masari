import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAccounts } from './useAccounts'
import { useProfile } from '@/features/profile/useProfile'
import { convertMinor } from '@/lib/money'
import { useFx } from '@/features/fx/FxProvider'
import { transactionsKey } from '@/features/transactions/useTransactions'

type Row = { account_id: string | null; type: 'expense' | 'income' | 'transfer'; amount: number; currency: string; occurred_at: string }

export type AccountBalance = {
  account: Account
  balance: number // in the account's currency, minor units
  balanceHome: number // converted to home currency
  movements: number // transactions counted since the anchor
}

/**
 * Balance per account = opening_balance + Σ income − Σ expense, counting only
 * transactions on that account dated after its opening_balance_at anchor.
 */
export function useAccountBalances() {
  const { user } = useAuth()
  const { data: accounts = [], isLoading: la } = useAccounts()
  const { data: profile } = useProfile()
  const home = profile?.home_currency ?? 'QAR'
  const { rate, snapshot } = useFx()

  const earliest = useMemo(() => {
    if (accounts.length === 0) return null
    return accounts.map((a) => a.opening_balance_at).sort()[0]
  }, [accounts])

  const { data: rows = [], isLoading: lt } = useQuery({
    queryKey: [...transactionsKey(user?.id ?? 'anon'), 'balances', earliest] as const,
    enabled: Boolean(user) && earliest !== null,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('account_id,type,amount,currency,occurred_at')
        .gte('occurred_at', earliest!)
        .not('account_id', 'is', null)
        .limit(20000)
      if (error) throw error
      return data as Row[]
    },
  })

  return useMemo(() => {
    const list: AccountBalance[] = accounts.map((account) => {
      let balance = account.opening_balance
      let movements = 0
      for (const r of rows) {
        if (r.account_id !== account.id || r.occurred_at < account.opening_balance_at) continue
        const amt = r.currency === account.currency ? r.amount : convertMinor(r.amount, r.currency, account.currency, rate(r.currency, account.currency))
        if (r.type === 'income') balance += amt
        else if (r.type === 'expense') balance -= amt
        else continue
        movements++
      }
      return {
        account,
        balance,
        balanceHome: convertMinor(balance, account.currency, home, rate(account.currency, home)),
        movements,
      }
    })
    const active = list.filter((b) => !b.account.is_archived)
    return {
      balances: active,
      archived: list.filter((b) => b.account.is_archived),
      totalHome: active.reduce((s, b) => s + b.balanceHome, 0),
      home,
      isLoading: la || lt,
    }
  }, [accounts, rows, home, la, lt, rate, snapshot])
}
