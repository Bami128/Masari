import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SavingsRow } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { monthStartKey } from '@/lib/dates'

export const savingsKey = (userId: string) => ['savings', userId] as const

export function useYearSavings(year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...savingsKey(user?.id ?? 'anon'), year] as const,
    enabled: Boolean(user),
    queryFn: async (): Promise<SavingsRow[]> => {
      const { data, error } = await supabase
        .from('savings')
        .select('*')
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-01`)
      if (error) throw error
      return data as SavingsRow[]
    },
  })
}

/** Set a manual savings figure for a month; null clears the override. */
export function useSetSavings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, amount }: { month: Date; amount: number | null }) => {
      const key = monthStartKey(month)
      if (amount === null) {
        const { error } = await supabase.from('savings').delete().eq('month', key)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('savings').upsert({ user_id: user!.id, month: key, amount }, { onConflict: 'user_id,month' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: savingsKey(user!.id) }),
  })
}
