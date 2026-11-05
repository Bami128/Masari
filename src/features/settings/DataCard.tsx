import { useState } from 'react'
import { Download, FileJson, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { deliverFile, toCsv } from '@/lib/download'
import { fromMinor } from '@/lib/money'
import type { Account, Category, Transaction } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { useFx } from '@/features/fx/FxProvider'
import { useProfile } from '@/features/profile/useProfile'

async function fetchAll<T>(table: string, order?: string): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select('*').range(from, from + page - 1)
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < page) break
  }
  return out
}

export function DataCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { snapshot, refresh, refreshing } = useFx()
  const { data: profile } = useProfile()
  const home = profile?.home_currency ?? 'QAR'
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null)
  const stamp = format(new Date(), 'yyyy-MM-dd')

  const exportCsv = async () => {
    setBusy('csv')
    try {
      const [txs, cats, accts] = await Promise.all([
        fetchAll<Transaction>('transactions', 'occurred_at'),
        fetchAll<Category>('categories'),
        fetchAll<Account>('accounts'),
      ])
      const cat = new Map(cats.map((c) => [c.id, c.name]))
      const acc = new Map(accts.map((a) => [a.id, a.name]))
      const csv = toCsv(
        ['date', 'time', 'type', 'amount', 'currency', 'amount_home', 'fx_rate', 'merchant', 'category', 'account', 'note', 'source', 'id'],
        txs.map((t) => {
          const d = new Date(t.occurred_at)
          return [
            format(d, 'yyyy-MM-dd'),
            format(d, 'HH:mm'),
            t.type,
            fromMinor(t.amount, t.currency),
            t.currency,
            fromMinor(t.amount_home, home),
            t.fx_rate,
            t.merchant,
            t.category_id ? cat.get(t.category_id) ?? '' : '',
            t.account_id ? acc.get(t.account_id) ?? '' : '',
            t.note,
            t.source,
            t.id,
          ]
        }),
      )
      const how = await deliverFile(`masari-transactions-${stamp}.csv`, csv, 'text/csv;charset=utf-8')
      toast(how === 'shared' ? `${txs.length} transactions ready to save` : `Downloaded ${txs.length} transactions`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const backupJson = async () => {
    setBusy('json')
    try {
      const tables = ['profiles', 'accounts', 'categories', 'transactions', 'budgets', 'recurring_rules', 'merchant_map', 'income_sources', 'savings'] as const
      const data: Record<string, unknown[]> = {}
      for (const t of tables) data[t] = await fetchAll(t)
      const payload = {
        app: 'masari',
        format: 1,
        exported_at: new Date().toISOString(),
        user_id: user?.id,
        note: 'Amounts are integers in minor units (1550 = 15.50). Keep this file private — it is your full financial record.',
        data,
      }
      const how = await deliverFile(`masari-backup-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json')
      toast(how === 'shared' ? 'Backup ready to save' : 'Backup downloaded')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Backup failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const fxLabel =
    snapshot.source === 'live'
      ? `Live rates · updated ${format(new Date(snapshot.fetchedAt), 'd MMM, HH:mm')}`
      : 'Using built-in approximate rates (no live fetch yet)'

  return (
    <Card>
      <CardTitle>Your data</CardTitle>
      <p className="text-xs text-muted mt-0.5">Export anytime. On a phone this opens the share sheet — pick Files, Drive, or email it to yourself.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={exportCsv} disabled={busy !== null} className="justify-start">
          <Download className="h-4 w-4" /> {busy === 'csv' ? 'Preparing…' : 'Export transactions (CSV)'}
        </Button>
        <Button variant="secondary" onClick={backupJson} disabled={busy !== null} className="justify-start">
          <FileJson className="h-4 w-4" /> {busy === 'json' ? 'Preparing…' : 'Full backup (JSON)'}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Exchange rates</p>
          <p className="text-xs text-muted truncate">{fxLabel}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing} aria-label="Refresh rates">
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </Button>
      </div>
    </Card>
  )
}
