import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { transactionsKey } from './useTransactions'

/** Slim rows for the whole year — enough for the category × month grid and savings math. */
export type YearTx = Pick<Transaction, 'id' | 'type' | 'amount_home' | 'category_id' | 'occurred_at' | 'merchant'>

export function useYearTransactions(year: number) {
  const { user } = useAuth()
  const from = new Date(year, 0, 1).toISOString()
  const to = new Date(year + 1, 0, 1).toISOString()
  return useQuery({
    queryKey: [...transactionsKey(user?.id ?? 'anon'), 'year', year] as const,
    enabled: Boolean(user),
    queryFn: async (): Promise<YearTx[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id,type,amount_home,category_id,occurred_at,merchant')
        .gte('occurred_at', from)
        .lt('occurred_at', to)
        .order('occurred_at', { ascending: false })
        .limit(10000)
      if (error) throw error
      return data as YearTx[]
    },
  })
}
