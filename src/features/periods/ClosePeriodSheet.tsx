import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarCheck } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { Period } from '@/lib/types'
import { useAccountBalances } from '@/features/accounts/useAccountBalances'
import { buildSnapshot, usePeriodSummary } from './usePeriodSummary'
import { useClosePeriod } from './usePeriods'
import { useLogSalary } from './useLogSalary'

export function ClosePeriodSheet({ open, onClose, period, previous, all }: { open: boolean; onClose: () => void; period: Period; previous: Period | null; all: Period[] }) {
  const s = usePeriodSummary(period, previous)
  const { balances } = useAccountBalances()
  const close = useClosePeriod()
  const salary = useLogSalary()
  const { toast } = useToast()
  const [copyBudgets, setCopyBudgets] = useState(true)
  const [logSalary, setLogSalary] = useState(salary.sources.length > 0)
  const [busy, setBusy] = useState(false)

  const effectiveIncome = s.received > 0 ? s.received : s.income
  const saved = effectiveIncome - s.spent

  const confirm = async () => {
    setBusy(true)
    try {
      const snapshot = buildSnapshot(s, balances, new Date())
      await close.mutateAsync({ period, snapshot, copyBudgets, existing: all })
      if (logSalary && salary.sources.length) await salary.mutateAsync()
      toast(`${period.name} closed · new period started${logSalary && salary.sources.length ? ' · salary logged' : ''}`)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not close the period', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Close this month?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Freezes <span className="font-medium text-ink">{period.name}</span> ({format(new Date(period.started_at), 'd MMM')} → today, {s.dayOf} days) into a saved report and starts a new period from right now.
        </p>

        <div className="rounded-2xl bg-hero text-white p-4 grid grid-cols-3 gap-3">
          <Stat label="Income" value={effectiveIncome > 0 ? formatMinor(effectiveIncome, s.home, { compact: true }) : '—'} sub={s.received > 0 ? 'logged' : 'planned'} />
          <Stat label="Spent" value={formatMinor(s.spent, s.home, { compact: true })} sub={`${s.txCount} transactions`} />
          <Stat label="Saved" value={effectiveIncome > 0 ? formatMinor(saved, s.home, { compact: true }) : '—'} sub={s.planned > 0 ? (s.left >= 0 ? `${formatMinor(s.left, s.home, { compact: true })} under budget` : `${formatMinor(-s.left, s.home, { compact: true })} over budget`) : ''} tone={saved < 0 ? 'neg' : 'pos'} />
        </div>

        {s.byCategory.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Top categories</p>
            <div className="flex flex-col gap-1.5">
              {s.byCategory.slice(0, 4).map((c) => (
                <div key={c.category_id ?? 'none'} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? '#94A3B8' }} />
                    {c.name}
                  </span>
                  <span className="tabular-nums">
                    {formatMinor(c.spent, s.home, { compact: true })}
                    {c.planned != null && <span className="text-muted"> / {formatMinor(c.planned, s.home, { compact: true })}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-1">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={copyBudgets} onChange={(e) => setCopyBudgets(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2F5BD6]" />
            <span>
              <span className="font-medium">Carry the budget over</span>
              <span className="block text-xs text-muted">Same planned amounts for the new period. You can edit them after.</span>
            </span>
          </label>
          <label className={cn('flex items-start gap-3 text-sm', salary.sources.length === 0 && 'opacity-50')}>
            <input type="checkbox" checked={logSalary} disabled={salary.sources.length === 0} onChange={(e) => setLogSalary(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2F5BD6]" />
            <span>
              <span className="font-medium">Log salary into the new period</span>
              <span className="block text-xs text-muted">
                {salary.sources.length ? salary.sources.map((x) => `${x.name} ${formatMinor(x.amount, x.currency, { compact: true })}`).join(' + ') + ' · dated today' : 'Add an income source on the Budget page first'}
              </span>
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Not yet
          </Button>
          <Button onClick={confirm} disabled={busy || s.isLoading} className="flex-1">
            <CalendarCheck className="h-4 w-4" /> {busy ? 'Closing…' : 'Close & start new'}
          </Button>
        </div>
        <p className="text-xs text-muted text-center">This can't be undone, but nothing is deleted — every transaction stays where it is.</p>
      </div>
    </Sheet>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums leading-tight', tone === 'neg' && 'text-red-300', tone === 'pos' && 'text-emerald-300')}>{value}</p>
      {sub && <p className="text-[11px] text-white/60 truncate">{sub}</p>}
    </div>
  )
}
