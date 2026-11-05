import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { monthKey, monthRange } from '@/lib/dates'
import { enqueue, isNetworkError } from '@/lib/outbox'

export const transactionsKey = (userId: string, month?: string) =>
  month ? (['transactions', userId, month] as const) : (['transactions', userId] as const)

export function useMonthTransactions(month: Date) {
  const { user } = useAuth()
  const { from, to } = monthRange(month)
  return useQuery({
    queryKey: transactionsKey(user?.id ?? 'anon', monthKey(month)),
    enabled: Boolean(user),
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('occurred_at', from.toISOString())
        .lte('occurred_at', to.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useRecentTransactions(limit = 5) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...transactionsKey(user?.id ?? 'anon'), 'recent', limit] as const,
    enabled: Boolean(user),
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export type TransactionInput = {
  type: Transaction['type']
  amount: number
  currency: string
  amount_home: number
  fx_rate: number
  merchant: string | null
  note: string | null
  category_id: string | null
  account_id: string | null
  occurred_at: string
  source: Transaction['source']
}

export type CreateResult = { row: Transaction; queued: boolean }

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for very old WebViews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Create a transaction, instantly.
 *  - The row is written into every cached transaction list right away (optimistic).
 *  - If the network is down or the request fails to reach Supabase, the row is parked
 *    in the outbox and replayed later. Same id both times, so no duplicates.
 */
export function useCreateTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const mutation = useMutation<CreateResult, Error, TransactionInput & { id: string }>({
    onMutate: async (input) => {
      const now = new Date().toISOString()
      const { id, ...payload } = input
      const optimistic: Transaction = { id, user_id: user!.id, recurring_rule_id: null, created_at: now, updated_at: now, ...payload }
      qc.setQueriesData<unknown>({ queryKey: transactionsKey(user!.id) }, (old: unknown) => {
        if (!Array.isArray(old)) return old
        if (old.some((r) => (r as { id?: string }).id === id)) return old
        return [optimistic, ...old]
      })
    },
    mutationFn: async (input) => {
      const { id, ...payload } = input
      const now = new Date().toISOString()
      const local: Transaction = { id, user_id: user!.id, recurring_rule_id: null, created_at: now, updated_at: now, ...payload }
      try {
        const { data, error } = await supabase
          .from('transactions')
          .insert({ id, user_id: user!.id, ...payload })
          .select('*')
          .single()
        if (error) {
          if (error.code === '23505') return { row: local, queued: false }
          if (isNetworkError(error)) throw error
          throw new Error(error.message)
        }
        return { row: data as Transaction, queued: false }
      } catch (e) {
        if (isNetworkError(e)) {
          enqueue({ id, user_id: user!.id, payload, queued_at: now })
          return { row: local, queued: true }
        }
        throw e
      }
    },
    onError: (_e, input) => {
      // Roll the optimistic row back only on a real rejection.
      qc.setQueriesData<unknown>({ queryKey: transactionsKey(user!.id) }, (old: unknown) =>
        Array.isArray(old) ? old.filter((r) => (r as { id?: string }).id !== input.id) : old,
      )
    },
    onSettled: (res) => {
      if (res?.queued) return // keep the optimistic row; refetch would drop it
      qc.invalidateQueries({ queryKey: transactionsKey(user!.id) })
    },
  })

  return {
    ...mutation,
    mutateAsync: (input: TransactionInput) => mutation.mutateAsync({ ...input, id: newId() }),
    mutate: (input: TransactionInput) => mutation.mutate({ ...input, id: newId() }),
  }
}

export function useUpdateTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TransactionInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transactionsKey(user!.id) }),
  })
}

export function useDeleteTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transactionsKey(user!.id) }),
  })
}
