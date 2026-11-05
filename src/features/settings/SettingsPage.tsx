import { useEffect, useState } from 'react'
import { LogOut, Plus, Pencil, Check, X, Archive } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input, Label, Select, Segmented } from '@/components/Field'
import { CategoryDot } from '@/components/CategoryDot'
import { useToast } from '@/components/Toast'
import { CATEGORY_COLORS, CURRENCIES, type Category } from '@/lib/types'
import { fromMinor, toMinor } from '@/lib/money'
import { cn } from '@/lib/cn'
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/features/categories/useCategories'
import { useCreateAccount, useSetAccountBalance, useSetDefaultAccount, useUpdateAccount } from '@/features/accounts/useAccounts'
import { useAccountBalances } from '@/features/accounts/useAccountBalances'
import { DataCard } from './DataCard'
import { SecurityCard } from '@/features/lock/SecurityCard'
import { MoneyInput } from '@/components/MoneyInput'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const avatar = user?.user_metadata?.avatar_url as string | undefined

  return (
    <>
      <PageHeader title="Settings" />

      <div className="grid gap-4">
        <ProfileCard />
        <SecurityCard />
        <CategoriesCard />
        <AccountsCard />
        <DataCard />

        <Card className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-surface-2" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted truncate">{user?.email}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-2">Masari v0.6</p>
      </div>
    </>
  )
}

function ProfileCard() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('QAR')
  const [salaryDay, setSalaryDay] = useState('')
  const [budget, setBudget] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!profile || dirty) return
    setName(profile.display_name ?? '')
    setCurrency(profile.home_currency)
    setSalaryDay(profile.salary_day ? String(profile.salary_day) : '')
    setBudget(profile.monthly_budget != null ? String(fromMinor(profile.monthly_budget, profile.home_currency)) : '')
  }, [profile, dirty])

  const save = async () => {
    const day = salaryDay ? Number(salaryDay) : null
    if (day !== null && (day < 1 || day > 31)) return toast('Salary day must be 1–31', 'error')
    const b = budget ? Number(budget.replace(/,/g, '')) : null
    if (b !== null && !Number.isFinite(b)) return toast('Budget must be a number', 'error')
    try {
      await update.mutateAsync({
        display_name: name.trim() || null,
        home_currency: currency,
        salary_day: day,
        monthly_budget: b !== null ? toMinor(b, currency) : null,
      })
      setDirty(false)
      toast('Saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setDirty(true)
    setter(v)
  }

  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => mark(setName)(e.target.value)} />
        </div>
        <div>
          <Label>Home currency</Label>
          <Select value={currency} onChange={(e) => mark(setCurrency)(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label hint="1–31">Salary day</Label>
          <Input inputMode="numeric" value={salaryDay} onChange={(e) => mark(setSalaryDay)(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
        <div>
          <Label>Monthly budget ({currency})</Label>
          <Input inputMode="decimal" value={budget} onChange={(e) => mark(setBudget)(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
          Save
        </Button>
      </div>
    </Card>
  )
}

function CategoriesCard() {
  const { data: categories = [] } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const { toast } = useToast()

  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0])
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const list = categories.filter((c) => c.kind === kind)

  const add = async () => {
    if (!newName.trim()) return
    try {
      await create.mutateAsync({ name: newName.trim(), kind, color: newColor })
      setNewName('')
      setAdding(false)
      toast('Category added')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add', 'error')
    }
  }

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return
    try {
      await update.mutateAsync({ id: editing.id, name: editName.trim(), color: editColor })
      setEditing(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  const del = async (id: string) => {
    try {
      await remove.mutateAsync(id)
      setConfirmId(null)
      setEditing(null)
      toast('Category deleted — its transactions are now uncategorized')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Categories</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <div className="mt-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
      </div>

      {adding && (
        <div className="mt-3 rounded-xl border border-line p-3 flex flex-col gap-3">
          <Input placeholder="Category name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <ColorRow value={newColor} onChange={setNewColor} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} disabled={create.isPending}>
              Add
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-2 divide-y divide-line">
        {list.map((c) =>
          editing?.id === c.id ? (
            <li key={c.id} className="py-3 flex flex-col gap-3">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
              <ColorRow value={editColor} onChange={setEditColor} />
              <div className="flex items-center gap-2">
                {confirmId === c.id ? (
                  <Button size="sm" variant="danger" onClick={() => del(c.id)} disabled={remove.isPending}>
                    Confirm delete
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(c.id)} className="text-neg">
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel">
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={update.isPending} aria-label="Save">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ) : (
            <li key={c.id} className="py-2.5 flex items-center gap-3">
              <CategoryDot color={c.color} className="h-3 w-3" />
              <span className="flex-1">{c.name}</span>
              <button
                onClick={() => {
                  setEditing(c)
                  setEditName(c.name)
                  setEditColor(c.color ?? CATEGORY_COLORS[0])
                  setConfirmId(null)
                }}
                className="text-muted hover:text-ink p-1"
                aria-label={`Edit ${c.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          ),
        )}
      </ul>
    </Card>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn('h-7 w-7 rounded-full border-2', value === c ? 'border-white' : 'border-transparent')}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function AccountsCard() {

  const { data: profile } = useProfile()
  const { balances, archived } = useAccountBalances()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const setBalance = useSetAccountBalance()
  const setDefault = useSetDefaultAccount()
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'cash' | 'bank' | 'card'>('bank')
  const [currency, setCurrency] = useState(profile?.home_currency ?? 'QAR')
  const [opening, setOpening] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    const n = opening.trim() ? Number(opening.replace(/,/g, '')) : 0
    if (!Number.isFinite(n)) return toast('Balance must be a number', 'error')
    try {
      await create.mutateAsync({ name: name.trim(), type, currency, opening_balance: toMinor(n, currency) })
      setName('')
      setOpening('')
      setAdding(false)
      toast('Account added')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add', 'error')
    }
  }

  const rows = showArchived ? [...balances, ...archived] : balances

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Accounts & balances</CardTitle>
          <p className="text-xs text-muted mt-0.5">Type what's in each account right now. Logged income and expenses move it from there.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {adding && (
        <div className="mt-3 rounded-xl border border-line p-3 flex flex-col gap-3">
          <Input placeholder="e.g. QNB current account" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
            </Select>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label hint="optional">Current balance ({currency})</Label>
            <Input inputMode="decimal" placeholder="0" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} disabled={create.isPending}>
              Add
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-2 divide-y divide-line">
        {rows.map(({ account: a, balance, movements }) => (
          <li key={a.id} className={cn('py-3', a.is_archived && 'opacity-50')}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => !a.is_default && setDefault.mutate(a.id)}
                title={a.is_default ? 'Default account' : 'Make default'}
                aria-label={a.is_default ? 'Default account' : 'Make default'}
                className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0', a.is_default ? 'border-accent' : 'border-line-2 hover:border-muted')}
              >
                {a.is_default && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm">{a.name}</p>
                <p className="text-xs text-muted">
                  <span className="capitalize">{a.type}</span> · {a.currency}
                  {movements > 0 && <> · {movements} movement{movements > 1 ? 's' : ''} since {new Date(a.opening_balance_at).toLocaleDateString()}</>}
                </p>
              </div>
              <div className="w-32">
                <MoneyInput
                  valueMinor={balance}
                  currency={a.currency}
                  onCommit={(v) => v !== null && setBalance.mutate({ id: a.id, balance: v }, { onSuccess: () => toast('Balance set') })}
                />
              </div>
              <button
                onClick={() => update.mutate({ id: a.id, is_archived: !a.is_archived })}
                className="text-muted hover:text-ink p-1"
                aria-label={a.is_archived ? 'Unarchive' : 'Archive'}
                title={a.is_archived ? 'Unarchive' : 'Archive'}
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">The circle marks the default account for Quick Add. Editing a balance re-anchors it to right now.</p>
      {archived.length > 0 && (
        <button onClick={() => setShowArchived((v) => !v)} className="mt-2 text-xs text-muted hover:text-ink-2">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      )}
    </Card>
  )
}
