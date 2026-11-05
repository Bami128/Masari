import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Landmark, Wallet, CreditCard, BadgeCheck } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/cn'
import { useAccountBalances } from './useAccountBalances'
import { useIncomeSources } from '@/features/income/useIncomeSources'
import { useMonthTransactions, useCreateTransaction } from '@/features/transactions/useTransactions'
import { useCategories } from '@/features/categories/useCategories'
import { useAccounts } from './useAccounts'
import { convertMinor } from '@/lib/money'
import { useFx } from '@/features/fx/FxProvider'

const ICONS = { bank: Landmark, cash: Wallet, card: CreditCard } as const

/** Home card: total + per-account balances, and a one-tap "log salary" when it hasn't been logged this month. */
export function AccountsCard() {
  const { balances, totalHome, home, isLoading } = useAccountBalances()
  const { data: sources = [] } = useIncomeSources()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: monthTx = [] } = useMonthTransactions(new Date())
  const create = useCreateTransaction()
  const { toast } = useToast()
  const { rate } = useFx()
  const [busy, setBusy] = useState(false)

  const activeSources = sources.filter((s) => s.is_active && s.amount > 0)
  const salaryLogged = useMemo(() => {
    const names = new Set(activeSources.map((s) => s.name.trim().toLowerCase()))
    return monthTx.some((t) => t.type === 'income' && t.merchant && names.has(t.merchant.trim().toLowerCase()))
  }, [monthTx, activeSources])

  const logSalary = async () => {
    setBusy(true)
    try {
      const salaryCat = categories.find((c) => c.kind === 'income' && /salary/i.test(c.name)) ?? categories.find((c) => c.kind === 'income') ?? null
      const def = accounts.find((a) => a.is_default && !a.is_archived) ?? accounts.find((a) => !a.is_archived) ?? null
      for (const s of activeSources) {
        const acct = accounts.find((a) => !a.is_archived && a.currency === s.currency) ?? def
        await create.mutateAsync({
          type: 'income',
          amount: s.amount,
          currency: s.currency,
          amount_home: convertMinor(s.amount, s.currency, home, rate(s.currency, home)),
          fx_rate: rate(s.currency, home),
          merchant: s.name,
          note: null,
          category_id: salaryCat?.id ?? null,
          account_id: acct?.id ?? null,
          occurred_at: new Date().toISOString(),
          source: 'manual',
        })
      }
      toast(activeSources.length === 1 ? `Logged ${activeSources[0].name}` : `Logged ${activeSources.length} income lines`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not log', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!isLoading && balances.length === 0) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <CardTitle>Accounts</CardTitle>
        <Link to="/settings" className="text-xs text-accent inline-flex items-center gap-1 font-medium">
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', totalHome < 0 && 'text-neg')}>{formatMinor(totalHome, home)}</p>
      <p className="text-xs text-muted">total across {balances.length} account{balances.length === 1 ? '' : 's'}</p>

      <div className="mt-3 divide-y divide-line">
        {balances.map(({ account, balance, balanceHome }) => {
          const Icon = ICONS[account.type]
          return (
            <div key={account.id} className="py-2.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-surface-2 flex items-center justify-center text-ink-2">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {account.name}
                  {account.is_default && <BadgeCheck className="h-3.5 w-3.5 text-accent" aria-label="Default" />}
                </p>
                <p className="text-xs text-muted capitalize">{account.type} · {account.currency}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold tabular-nums', balance < 0 && 'text-neg')}>{formatMinor(balance, account.currency)}</p>
                {account.currency !== home && <p className="text-xs text-muted tabular-nums">≈ {formatMinor(balanceHome, home)}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {activeSources.length > 0 && !salaryLogged && (
        <div className="mt-3 rounded-xl bg-accent-soft p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-accent-2">Got paid this month?</p>
            <p className="text-xs text-ink-2 truncate">
              Logs {activeSources.map((s) => `${s.name} ${formatMinor(s.amount, s.currency, { compact: true })}`).join(' + ')} as income today
            </p>
          </div>
          <Button size="sm" onClick={logSalary} disabled={busy}>
            Log it
          </Button>
        </div>
      )}
    </Card>
  )
}
