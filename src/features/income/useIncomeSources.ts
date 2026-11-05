import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IncomeSource } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const incomeKey = (userId: string) => ['income_sources', userId] as const

export function useIncomeSources() {
  const { user } = useAuth()
  return useQuery({
    queryKey: incomeKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<IncomeSource[]> => {
      const { data, error } = await supabase.from('income_sources').select('*').order('sort_order').order('created_at')
      if (error) throw error
      return data as IncomeSource[]
    },
  })
}

export function useCreateIncomeSource() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<IncomeSource, 'name' | 'amount' | 'currency'>) => {
      const { error } = await supabase.from('income_sources').insert({ ...input, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: incomeKey(user!.id) }),
  })
}

export function useUpdateIncomeSource() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<IncomeSource> & { id: string }) => {
      const { error } = await supabase.from('income_sources').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: incomeKey(user!.id) }),
  })
}

export function useDeleteIncomeSource() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('income_sources').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: incomeKey(user!.id) }),
  })
}
