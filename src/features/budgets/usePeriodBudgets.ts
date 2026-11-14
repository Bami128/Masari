import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Budget } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const budgetsKey = (userId: string) => ['budgets', userId] as const

export function usePeriodBudgets(periodId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...budgetsKey(user?.id ?? 'anon'), 'period', periodId] as const,
    enabled: Boolean(user) && periodId !== null,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('*').eq('period_id', periodId!)
      if (error) throw error
      return data as Budget[]
    },
  })
}

/** Set one line for a period (category_id null = overall). limit null deletes it. */
export function useSetPeriodBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ periodId, category_id, limit_amount }: { periodId: string; category_id: string | null; limit_amount: number | null }) => {
      let q = supabase.from('budgets').select('id').eq('period_id', periodId)
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
        const { error } = await supabase.from('budgets').insert({ user_id: user!.id, period_id: periodId, category_id, limit_amount })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey(user!.id) }),
  })
}

/** Copy lines from one period to another (skips categories already set in the target). Also accepts legacy month rows. */
export function useCopyPeriodBudgets() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fromPeriodId, fromMonth, toPeriodId }: { fromPeriodId?: string; fromMonth?: string; toPeriodId: string }) => {
      let srcQ = supabase.from('budgets').select('*')
      srcQ = fromPeriodId ? srcQ.eq('period_id', fromPeriodId) : srcQ.eq('month', fromMonth!).is('period_id', null)
      const [{ data: src, error: e1 }, { data: dst, error: e2 }] = await Promise.all([srcQ, supabase.from('budgets').select('category_id').eq('period_id', toPeriodId)])
      if (e1) throw e1
      if (e2) throw e2
      const have = new Set((dst ?? []).map((b) => b.category_id ?? '__overall__'))
      const rows = (src as Budget[])
        .filter((b) => !have.has(b.category_id ?? '__overall__'))
        .map((b) => ({ user_id: user!.id, period_id: toPeriodId, category_id: b.category_id, limit_amount: b.limit_amount, rollover: b.rollover }))
      if (rows.length === 0) return 0
      const { error } = await supabase.from('budgets').insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey(user!.id) }),
  })
}
