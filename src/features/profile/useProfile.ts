import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const profileKey = (userId: string) => ['profile', userId] as const

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: profileKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user!.id)
        .select('*')
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: (data) => {
      qc.setQueryData(profileKey(user!.id), data)
    },
  })
}
