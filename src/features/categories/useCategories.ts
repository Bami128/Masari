import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category, MerchantMapRow } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const categoriesKey = (userId: string) => ['categories', userId] as const
export const merchantMapKey = (userId: string) => ['merchant_map', userId] as const

export function useCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: categoriesKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('kind')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

export function useMerchantMap() {
  const { user } = useAuth()
  return useQuery({
    queryKey: merchantMapKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<MerchantMapRow[]> => {
      const { data, error } = await supabase.from('merchant_map').select('*')
      if (error) throw error
      return data as MerchantMapRow[]
    },
  })
}

export function useLearnMerchant() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ merchant, categoryId }: { merchant: string; categoryId: string }) => {
      const pattern = merchant.trim().toLowerCase()
      if (!pattern) return
      const { data: existing } = await supabase
        .from('merchant_map')
        .select('id, hit_count')
        .eq('pattern', pattern)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('merchant_map')
          .update({ category_id: categoryId, hit_count: (existing.hit_count as number) + 1 })
          .eq('id', existing.id)
      } else {
        await supabase.from('merchant_map').insert({ user_id: user!.id, pattern, category_id: categoryId })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantMapKey(user!.id) }),
  })
}

export function useCreateCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Category, 'name' | 'kind' | 'color'> & { icon?: string | null }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...input, user_id: user!.id, sort_order: 99 })
        .select('*')
        .single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey(user!.id) }),
  })
}

export function useUpdateCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Category> & { id: string }) => {
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey(user!.id) }),
  })
}

export function useDeleteCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoriesKey(user!.id) })
      qc.invalidateQueries({ queryKey: ['transactions', user!.id] })
    },
  })
}
