import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Budget, Period, PeriodSnapshot } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const periodsKey = (userId: string) => ['periods', userId] as const

export function usePeriods() {
  const { user } = useAuth()
  return useQuery({
    queryKey: periodsKey(user?.id ?? 'anon'),
    enabled: Boolean(user),
    queryFn: async (): Promise<Period[]> => {
      const { data, error } = await supabase.from('periods').select('*').order('started_at', { ascending: false })
      if (error) throw error
      return data as Period[]
    },
  })
}

export function periodName(startedAt: Date, existing: Period[]): string {
  const base = format(startedAt, 'MMM yyyy')
  const taken = existing.filter((p) => p.name === base || p.name.startsWith(`${base} (`)).length
  return taken === 0 ? base : `${base} (${taken + 1})`
}

/**
 * The open period. If the user has none yet (first run after the upgrade), one is created
 * starting at the earliest of: their first transaction, or the 1st of the current month —
 * so everything logged so far lands inside it.
 */
export function useCurrentPeriod() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const periods = usePeriods()
  const open = useMemo(() => periods.data?.find((p) => p.closed_at === null) ?? null, [periods.data])

  const ensure = useMutation({
    mutationFn: async () => {
      const { data: first } = await supabase
        .from('transactions')
        .select('occurred_at')
        .order('occurred_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstTx = first?.occurred_at ? new Date(first.occurred_at as string) : null
      const startedAt = firstTx && firstTx < monthStart ? firstTx : monthStart
      const { data: created, error } = await supabase
        .from('periods')
        .insert({ user_id: user!.id, name: periodName(startedAt, periods.data ?? []), started_at: startedAt.toISOString() })
        .select('id')
        .single()
      if (error && error.code !== '23505') throw error
      if (created?.id) {
        // Upgrade path: the user's existing calendar-month budget (latest month) becomes this period's budget.
        const { data: latest } = await supabase
          .from('budgets')
          .select('month')
          .is('period_id', null)
          .not('month', 'is', null)
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latest?.month) {
          await supabase.from('budgets').update({ period_id: created.id }).is('period_id', null).eq('month', latest.month)
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: periodsKey(user!.id) }),
  })

  useEffect(() => {
    if (!user || periods.isLoading || periods.isError) return
    if (!open && !ensure.isPending && !ensure.isSuccess) ensure.mutate()
  }, [user, periods.isLoading, periods.isError, open]) // eslint-disable-line react-hooks/exhaustive-deps

  return { period: open, periods: periods.data ?? [], isLoading: periods.isLoading || (!open && !periods.isError) }
}

export function useUpdatePeriod() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Pick<Period, 'name' | 'saved_override' | 'note'>> & { id: string }) => {
      const { error } = await supabase.from('periods').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: periodsKey(user!.id) }),
  })
}

/**
 * Close the open period and start a new one from this moment.
 * The snapshot is computed by the caller (it already has everything loaded).
 */
export function useClosePeriod() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      period,
      snapshot,
      copyBudgets,
      existing,
    }: {
      period: Period
      snapshot: PeriodSnapshot
      copyBudgets: boolean
      existing: Period[]
    }): Promise<Period> => {
      const now = new Date()
      const { error: e1 } = await supabase
        .from('periods')
        .update({ closed_at: now.toISOString(), snapshot })
        .eq('id', period.id)
        .is('closed_at', null)
      if (e1) throw e1

      const { data: created, error: e2 } = await supabase
        .from('periods')
        .insert({ user_id: user!.id, name: periodName(now, existing), started_at: now.toISOString() })
        .select('*')
        .single()
      if (e2) throw e2
      const next = created as Period

      if (copyBudgets) {
        const { data: lines, error: e3 } = await supabase.from('budgets').select('*').eq('period_id', period.id)
        if (e3) throw e3
        const rows = (lines as Budget[]).map((b) => ({
          user_id: user!.id,
          period_id: next.id,
          category_id: b.category_id,
          limit_amount: b.limit_amount,
          rollover: b.rollover,
        }))
        if (rows.length) {
          const { error: e4 } = await supabase.from('budgets').insert(rows)
          if (e4) throw e4
        }
      }
      return next
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodsKey(user!.id) })
      qc.invalidateQueries({ queryKey: ['budgets', user!.id] })
      qc.invalidateQueries({ queryKey: ['transactions', user!.id] })
    },
  })
}

/** Where the open period is expected to end — next salary day, else last period's length, else 30 days. */
export function expectedPeriodEnd(period: Period, salaryDay: number | null, previous: Period | null): Date {
  const start = new Date(period.started_at)
  if (salaryDay) {
    const sameMonth = new Date(start.getFullYear(), start.getMonth(), Math.min(salaryDay, 28))
    const minGap = 10 * 86400000
    if (sameMonth.getTime() - start.getTime() > minGap) return sameMonth
    return new Date(start.getFullYear(), start.getMonth() + 1, Math.min(salaryDay, 28))
  }
  if (previous?.closed_at) {
    const len = new Date(previous.closed_at).getTime() - new Date(previous.started_at).getTime()
    if (len > 7 * 86400000) return new Date(start.getTime() + len)
  }
  return new Date(start.getTime() + 30 * 86400000)
}
