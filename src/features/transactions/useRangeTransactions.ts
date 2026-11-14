import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { transactionsKey } from './useTransactions'

/** Transactions in [from, to). `to` null = open-ended (now). */
export function useRangeTransactions(from: Date | null, to: Date | null) {
  const { user } = useAuth()
  const fromIso = from?.toISOString() ?? null
  const toIso = to?.toISOString() ?? null
  return useQuery({
    queryKey: [...transactionsKey(user?.id ?? 'anon'), 'range', fromIso, toIso] as const,
    enabled: Boolean(user) && fromIso !== null,
    queryFn: async (): Promise<Transaction[]> => {
      let q = supabase.from('transactions').select('*').gte('occurred_at', fromIso!)
      if (toIso) q = q.lt('occurred_at', toIso)
      const { data, error } = await q.order('occurred_at', { ascending: false }).limit(5000)
      if (error) throw error
      return data as Transaction[]
    },
  })
}
