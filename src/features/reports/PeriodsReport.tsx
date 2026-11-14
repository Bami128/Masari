import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, CalendarCheck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardTitle } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { MoneyInput } from '@/components/MoneyInput'
import { CategoryDot } from '@/components/CategoryDot'
import { ProgressBar } from '@/components/ProgressBar'
import { formatMinor, fromMinor } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { Period, PeriodSnapshot } from '@/lib/types'
import { useCurrentPeriod, useUpdatePeriod } from '@/features/periods/usePeriods'
import { usePeriodSummary } from '@/features/periods/usePeriodSummary'
import { useProfile } from '@/features/profile/useProfile'

type Row = { period: Period; snap: PeriodSnapshot; saved: number; isOpen: boolean }

export function PeriodsReport() {
  const { periods, period: open } = useCurrentPeriod()
  const { data: profile } = useProfile()
  const home = profile?.home_currency ?? 'QAR'
  const closed = useMemo(() => periods.filter((p) => p.closed_at && p.snapshot), [periods])
  const previous = closed[0] ?? null
  const live = usePeriodSummary(open, previous)
  const update = useUpdatePeriod()
  const [expanded, setExpanded] = useState<string | null>(null)

  // Oldest → newest for charts
  const rows: Row[] = useMemo(() => {
    const r: Row[] = closed
      .map((p) => ({ period: p, snap: p.snapshot as PeriodSnapshot, saved: p.saved_override ?? (p.snapshot as PeriodSnapshot).saved, isOpen: false }))
      .reverse()
    if (open) {
      const eff = live.received > 0 ? live.received : live.income
      r.push({
        period: open,
        isOpen: true,
        saved: live.actualSaved,
        snap: {
          home_currency: home,
          started_at: open.started_at,
          closed_at: new Date().toISOString(),
          days: live.dayOf,
          tx_count: live.txCount,
          income: live.income,
          received: live.received,
          spent: live.spent,
          planned: live.planned,
          saved: eff - live.spent,
          by_category: live.byCategory,
          top_merchants: live.topMerchants,
          balances: [],
        },
      })
    }
    return r
  }, [closed, open, live, home])

  const chart = useMemo(() => {
    let cum = 0
    return rows.slice(-12).map((r) => {
      const eff = r.snap.received > 0 ? r.snap.received : r.snap.income
      cum += r.saved
      return {
        name: r.period.name.replace(/ \d{4}/, '') + (r.isOpen ? '*' : ''),
        income: fromMinor(eff, home),
        spent: fromMinor(r.snap.spent, home),
        saved: fromMinor(r.saved, home),
        cumulative: fromMinor(cum, home),
      }
    })
  }, [rows, home])

  const closedOnly = rows.filter((r) => !r.isOpen)
  const avg = (f: (r: Row) => number) => (closedOnly.length ? Math.round(closedOnly.reduce((s, r) => s + f(r), 0) / closedOnly.length) : 0)
  const totalSaved = closedOnly.reduce((s, r) => s + r.saved, 0)

  // category × period matrix (last 8 periods)
  const matrix = useMemo(() => {
    const cols = rows.slice(-8)
    const names = new Map<string, { name: string; color: string | null; cells: number[]; total: number }>()
    cols.forEach((r, i) => {
      for (const c of r.snap.by_category) {
        const key = c.category_id ?? '__none__'
        if (!names.has(key)) names.set(key, { name: c.name, color: c.color, cells: Array(cols.length).fill(0), total: 0 })
        const row = names.get(key)!
        row.cells[i] += c.spent
        row.total += c.spent
      }
    })
    return { cols, rows: [...names.values()].sort((a, b) => b.total - a.total) }
  }, [rows])

  const fmt = (v: number) => (v === 0 ? <span className="text-muted-2">·</span> : formatMinor(v, home, { compact: true }).replace(/^[A-Z]{3}\s?/, ''))
  const tip = (v: unknown) => formatMinor(Math.round(Number(v) * 100), home)

  if (closed.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarCheck}
          title="No closed periods yet"
          body='When you get paid, press "Close month" on Home. The finished period lands here as a saved report, and every close after that builds the comparison.'
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <CardTitle>Closed</CardTitle>
          <p className="mt-1 font-semibold tabular-nums">{closedOnly.length} period{closedOnly.length === 1 ? '' : 's'}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Avg spent</CardTitle>
          <p className="mt-1 font-semibold tabular-nums">{formatMinor(avg((r) => r.snap.spent), home, { compact: true })}</p>
        </Card>
        <Card className="p-3">
          <CardTitle>Total saved</CardTitle>
          <p className={cn('mt-1 font-semibold tabular-nums', totalSaved < 0 ? 'text-neg' : 'text-pos')}>{formatMinor(totalSaved, home, { compact: true })}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Income · Spent · Saved per period</CardTitle>
        <p className="text-xs text-muted mt-0.5">* = current open period, live</p>
        <div className="mt-3 h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="#E5E9EF" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: '1px solid #E5E9EF', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" name="Income" fill="#0F1B2D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spent" name="Spent" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saved" name="Saved" fill="#2F5BD6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardTitle>Savings over time</CardTitle>
        <p className="text-xs text-muted mt-0.5">Cumulative saved across periods</p>
        <div className="mt-3 h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E5E9EF" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: '1px solid #E5E9EF', fontSize: 12 }} />
              <Line type="monotone" dataKey="cumulative" name="Saved (cumulative)" stroke="#2F5BD6" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Period cards */}
      <div className="flex flex-col gap-3">
        {[...rows].reverse().map(({ period: p, snap, saved, isOpen }) => {
          const eff = snap.received > 0 ? snap.received : snap.income
          const isExp = expanded === p.id
          return (
            <Card key={p.id} className={cn(isOpen && 'border-accent/40')}>
              <button className="w-full text-left" onClick={() => setExpanded(isExp ? null : p.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {p.name}
                      {isOpen && <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent-soft rounded-full px-2 py-0.5">open</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {format(new Date(snap.started_at), 'd MMM')} → {isOpen ? 'now' : format(new Date(snap.closed_at), 'd MMM')} · {snap.days} days · {snap.tx_count} transactions
                    </p>
                  </div>
                  {isExp ? <ChevronUp className="h-4 w-4 text-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted shrink-0" />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Income</p>
                    <p className="font-semibold tabular-nums">{eff > 0 ? formatMinor(eff, home, { compact: true }) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Spent</p>
                    <p className="font-semibold tabular-nums">{formatMinor(snap.spent, home, { compact: true })}</p>
                    {snap.planned > 0 && <ProgressBar value={snap.spent} max={snap.planned} className="mt-1 h-1" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Saved</p>
                    <p className={cn('font-semibold tabular-nums', saved < 0 ? 'text-neg' : 'text-pos')}>{eff > 0 ? formatMinor(saved, home, { compact: true }) : '—'}</p>
                  </div>
                </div>
              </button>

              {isExp && (
                <div className="mt-4 pt-4 border-t border-line flex flex-col gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">By category</p>
                    <div className="flex flex-col gap-2">
                      {snap.by_category.map((c) => (
                        <div key={c.category_id ?? 'none'}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <CategoryDot color={c.color} /> {c.name}
                            </span>
                            <span className="tabular-nums">
                              <span className={cn(c.planned != null && c.spent > c.planned && 'text-neg font-medium')}>{formatMinor(c.spent, home, { compact: true })}</span>
                              {c.planned != null && <span className="text-muted"> / {formatMinor(c.planned, home, { compact: true })}</span>}
                            </span>
                          </div>
                          <ProgressBar value={c.spent} max={c.planned ?? Math.max(1, snap.spent)} className="h-1" tone={c.planned == null ? 'accent' : 'auto'} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {snap.top_merchants.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Top merchants</p>
                      <div className="flex flex-wrap gap-2">
                        {snap.top_merchants.slice(0, 6).map((m) => (
                          <span key={m.merchant} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                            <span className="capitalize">{m.merchant}</span>
                            <span className="text-muted tabular-nums">{formatMinor(m.spent, home, { compact: true })} · {m.count}×</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isOpen && snap.balances.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">Balances at close</p>
                      <div className="flex flex-col gap-1 text-sm">
                        {snap.balances.map((b) => (
                          <div key={b.account_id} className="flex justify-between">
                            <span>{b.name}</span>
                            <span className="tabular-nums">{formatMinor(b.balance, b.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isOpen && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Actually saved</p>
                        <p className="text-xs text-muted">Override if you moved a different amount to savings</p>
                      </div>
                      <div className="w-32">
                        <MoneyInput valueMinor={p.saved_override} currency={home} placeholder={String(fromMinor(snap.saved, home))} onCommit={(v) => update.mutate({ id: p.id, saved_override: v })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Category × period matrix */}
      {matrix.rows.length > 0 && matrix.cols.length > 1 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <CardTitle>Category × period</CardTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-left font-medium px-4 py-2 sticky left-0 bg-surface min-w-36">Category</th>
                  {matrix.cols.map((c) => (
                    <th key={c.period.id} className={cn('font-medium px-2 py-2 text-right min-w-16', c.isOpen && 'text-accent')}>
                      {c.period.name.replace(/ \d{4}/, '')}
                    </th>
                  ))}
                  <th className="font-semibold px-4 py-2 text-right text-ink">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {matrix.rows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-4 py-2 sticky left-0 bg-surface">
                      <span className="flex items-center gap-2 font-medium">
                        <CategoryDot color={r.color} /> <span className="truncate">{r.name}</span>
                      </span>
                    </td>
                    {r.cells.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right">{fmt(v)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line-2 bg-surface-2/40 font-semibold">
                <tr>
                  <td className="px-4 py-2 sticky left-0 bg-surface-2">Spent</td>
                  {matrix.cols.map((c) => (
                    <td key={c.period.id} className="px-2 py-2 text-right">{fmt(c.snap.spent)}</td>
                  ))}
                  <td className="px-4 py-2 text-right">{fmt(matrix.cols.reduce((s, c) => s + c.snap.spent, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
