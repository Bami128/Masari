import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const accountsKey = (userId: string) => ['accounts', userId] as const

export function useAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: accountsKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from('accounts').select('*').order('created_at')
      if (error) throw error
      return data as Account[]
    },
  })
}

export function useCreateAccount() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Account, 'name' | 'type' | 'currency'> & { opening_balance?: number }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ ...input, user_id: user!.id, opening_balance_at: new Date().toISOString() })
        .select('*')
        .single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKey(user!.id) }),
  })
}

/** "Right now this account has X" — re-anchors the balance at this moment. */
export function useSetAccountBalance() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, balance }: { id: string; balance: number }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ opening_balance: balance, opening_balance_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountsKey(user!.id) })
      qc.invalidateQueries({ queryKey: ['transactions', user!.id] })
    },
  })
}

export function useSetDefaultAccount() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from('accounts').update({ is_default: false }).eq('user_id', user!.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('accounts').update({ is_default: true }).eq('id', id)
      if (e2) throw e2
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKey(user!.id) }),
  })
}

export function useUpdateAccount() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Account> & { id: string }) => {
      const { error } = await supabase.from('accounts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKey(user!.id) }),
  })
}
