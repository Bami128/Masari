import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { Input, Label, Select, Segmented, Textarea } from '@/components/Field'
import { CategoryPicker } from '@/components/CategoryPicker'
import { useToast } from '@/components/Toast'
import { CURRENCIES, type Transaction, type TransactionType } from '@/lib/types'
import { fromMinor, minorDigits, toMinor, convertMinor } from '@/lib/money'
import { isPegged } from '@/lib/fx'
import { useFx } from '@/features/fx/FxProvider'
import { fromDateInputValue, toDateInputValue } from '@/lib/dates'
import { useProfile } from '@/features/profile/useProfile'
import { useCategories, useLearnMerchant } from '@/features/categories/useCategories'
import { useAccounts } from '@/features/accounts/useAccounts'
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from './useTransactions'

export type TransactionDraft = {
  type?: TransactionType
  amountMinor?: number
  currency?: string
  merchant?: string
  category_id?: string | null
  account_id?: string | null
  occurred_at?: Date
  note?: string
}

type Props = {
  open: boolean
  onClose: () => void
  draft?: TransactionDraft
  editing?: Transaction
}

export function TransactionSheet({ open, onClose, draft, editing }: Props) {
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const learn = useLearnMerchant()
  const { toast } = useToast()
  const { rate: fxRate } = useFx()

  const home = profile?.home_currency ?? 'QAR'

  const [type, setType] = useState<TransactionType>('expense')
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState(home)
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [rateText, setRateText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // (Re)initialise whenever the sheet opens.
  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)
    if (editing) {
      setType(editing.type)
      setAmountText(String(fromMinor(editing.amount, editing.currency)))
      setCurrency(editing.currency)
      setMerchant(editing.merchant ?? '')
      setCategoryId(editing.category_id)
      setAccountId(editing.account_id)
      setDate(toDateInputValue(new Date(editing.occurred_at)))
      setNote(editing.note ?? '')
      setRateText(editing.currency === home ? '' : String(editing.fx_rate))
    } else {
      const cur = draft?.currency ?? home
      setType(draft?.type ?? 'expense')
      setAmountText(draft?.amountMinor != null ? String(fromMinor(draft.amountMinor, cur)) : '')
      setCurrency(cur)
      setMerchant(draft?.merchant ?? '')
      setCategoryId(draft?.category_id ?? null)
      setAccountId(draft?.account_id ?? (accounts.find((a) => a.is_default && !a.is_archived) ?? accounts.find((a) => !a.is_archived))?.id ?? null)
      setDate(toDateInputValue(draft?.occurred_at ?? new Date()))
      setNote(draft?.note ?? '')
      setRateText(cur === home ? '' : String(fxRate(cur, home)))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // When currency changes to something foreign, prefill a rate.
  useEffect(() => {
    if (!open) return
    if (currency === home) setRateText('')
    else if (!rateText) setRateText(String(fxRate(currency, home)))
  }, [currency]) // eslint-disable-line react-hooks/exhaustive-deps

  const kind = type === 'income' ? 'income' : 'expense'
  const amountMinor = useMemo(() => {
    const n = Number(amountText.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? toMinor(n, currency) : 0
  }, [amountText, currency])

  const rate = currency === home ? 1 : Number(rateText) || fxRate(currency, home)
  const amountHome = convertMinor(amountMinor, currency, home, rate)
  const busy = create.isPending || update.isPending || remove.isPending

  const save = async () => {
    if (amountMinor <= 0) {
      toast('Enter an amount', 'error')
      return
    }
    const occurred = fromDateInputValue(date, editing ? new Date(editing.occurred_at) : new Date())
    const payload = {
      type,
      amount: amountMinor,
      currency,
      amount_home: amountHome,
      fx_rate: rate,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      category_id: categoryId,
      account_id: accountId,
      occurred_at: occurred.toISOString(),
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload })
        toast('Updated')
      } else {
        const res = await create.mutateAsync({ ...payload, source: 'manual' })
        toast(res.queued ? 'Saved offline — will sync when online' : 'Saved')
      }
      if (categoryId && merchant.trim()) learn.mutate({ merchant, categoryId })
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  const doDelete = async () => {
    if (!editing) return
    try {
      await remove.mutateAsync(editing.id)
      toast('Deleted')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'New transaction'}>
      <div className="flex flex-col gap-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <Label>Amount</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="text-2xl font-semibold tabular-nums"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {currency !== home && (
          <div>
            <Label hint={isPegged(currency) && isPegged(home) ? 'fixed peg' : 'approximate — edit if you know it'}>
              Rate: 1 {currency} = ? {home}
            </Label>
            <Input inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value)} />
            {amountMinor > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                ≈ {fromMinor(amountHome, home).toFixed(minorDigits(home))} {home}
              </p>
            )}
          </div>
        )}

        <div>
          <Label>{type === 'income' ? 'From' : 'Merchant'}</Label>
          <Input
            placeholder={type === 'income' ? 'e.g. Salary' : 'e.g. Starbucks'}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>

        <div>
          <Label>Category</Label>
          <CategoryPicker categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Account</Label>
            <Select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value || null)}>
              <option value="">—</option>
              {accounts
                .filter((a) => !a.is_archived || a.id === accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Note</Label>
          <Textarea placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          {editing &&
            (confirmDelete ? (
              <Button variant="danger" onClick={doDelete} disabled={busy}>
                Confirm delete
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            ))}
          <Button onClick={save} disabled={busy} className="flex-1">
            {editing ? 'Save changes' : 'Save'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
