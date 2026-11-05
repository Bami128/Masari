import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Budget } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { monthStartKey } from '@/lib/dates'

export const budgetsKey = (userId: string, month?: string) =>
  month ? (['budgets', userId, month] as const) : (['budgets', userId] as const)

export function useMonthBudgets(month: Date) {
  const { user } = useAuth()
  const key = monthStartKey(month)
  return useQuery({
    queryKey: budgetsKey(user?.id ?? 'anon', key),
    enabled: Boolean(user),
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('*').eq('month', key)
      if (error) throw error
      return data as Budget[]
    },
  })
}

export function useYearBudgets(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...budgetsKey(user?.id ?? 'anon'), 'year', year] as const,
    enabled: Boolean(user),
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-01`)
      if (error) throw error
      return data as Budget[]
    },
  })
}

/** Insert or update one budget line (category_id null = overall). limit null deletes the line. */
export function useSetBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, category_id, limit_amount }: { month: Date; category_id: string | null; limit_amount: number | null }) => {
      const key = monthStartKey(month)
      let q = supabase.from('budgets').select('id').eq('month', key)
      q = category_id === null ? q.is('category_id', null) : q.eq('category_id', category_id)
      const { data: existing, error: e1 } = await q.maybeSingle()
      if (e1) throw e1

      if (limit_amount === null) {
        if (existing) {
          const { error } = await supabase.from('budgets').delete().eq('id', existing.id)
          if (error) throw error
        }
        return
      }
      if (existing) {
        const { error } = await supabase.from('budgets').update({ limit_amount }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('budgets').insert({ user_id: user!.id, month: key, category_id, limit_amount })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey(user!.id) }),
  })
}

/** Copy every line from one month to another (skips lines that already exist in the target). */
export function useCopyBudgets() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ from, to }: { from: Date; to: Date }) => {
      const fromKey = monthStartKey(from)
      const toKey = monthStartKey(to)
      const [{ data: src, error: e1 }, { data: dst, error: e2 }] = await Promise.all([
        supabase.from('budgets').select('*').eq('month', fromKey),
        supabase.from('budgets').select('category_id').eq('month', toKey),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const have = new Set((dst ?? []).map((b) => b.category_id ?? '__overall__'))
      const rows = (src as Budget[])
        .filter((b) => !have.has(b.category_id ?? '__overall__'))
        .map((b) => ({ user_id: user!.id, month: toKey, category_id: b.category_id, limit_amount: b.limit_amount, rollover: b.rollover }))
      if (rows.length === 0) return 0
      const { error } = await supabase.from('budgets').insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey(user!.id) }),
  })
}
