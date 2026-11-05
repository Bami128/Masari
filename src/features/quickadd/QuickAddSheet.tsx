import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { Input } from '@/components/Field'
import { CategoryPicker } from '@/components/CategoryPicker'
import { useToast } from '@/components/Toast'
import { parseQuickAdd } from '@/lib/quickAdd'
import { suggestCategory } from '@/lib/suggestCategory'
import { formatMinor, convertMinor } from '@/lib/money'
import { useFx } from '@/features/fx/FxProvider'
import { useProfile } from '@/features/profile/useProfile'
import { useCategories, useLearnMerchant, useMerchantMap } from '@/features/categories/useCategories'
import { useAccounts } from '@/features/accounts/useAccounts'
import { useCreateTransaction } from '@/features/transactions/useTransactions'
import { useQuickAdd } from './QuickAddContext'

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const { data: learned = [] } = useMerchantMap()
  const { data: accounts = [] } = useAccounts()
  const create = useCreateTransaction()
  const learn = useLearnMerchant()
  const { toast } = useToast()
  const { openForm } = useQuickAdd()
  const { rate: fxRate } = useFx()

  const home = profile?.home_currency ?? 'QAR'
  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [touchedCategory, setTouchedCategory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setText('')
      setCategoryId(null)
      setTouchedCategory(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const parsed = useMemo(() => parseQuickAdd(text, home), [text, home])
  const kind = parsed?.type === 'income' ? 'income' : 'expense'

  // Auto-suggest category until the user picks one manually.
  useEffect(() => {
    if (touchedCategory) return
    if (!parsed) {
      setCategoryId(null)
      return
    }
    const s = suggestCategory(parsed.merchant, kind, categories, learned)
    setCategoryId(s?.id ?? null)
  }, [parsed, kind, categories, learned, touchedCategory])

  const currency = parsed?.currency ?? home
  const rate = fxRate(currency, home)

  const save = async () => {
    if (!parsed) {
      toast('Type something like "coffee 15"', 'error')
      return
    }
    try {
      const res = await create.mutateAsync({
        type: parsed.type,
        amount: parsed.amountMinor,
        currency,
        amount_home: convertMinor(parsed.amountMinor, currency, home, rate),
        fx_rate: rate,
        merchant: parsed.merchant || null,
        note: null,
        category_id: categoryId,
        account_id: (accounts.find((a) => a.is_default && !a.is_archived) ?? accounts.find((a) => !a.is_archived))?.id ?? null,
        occurred_at: new Date().toISOString(),
        source: 'quickadd',
      })
      if (categoryId && parsed.merchant && !res.queued) learn.mutate({ merchant: parsed.merchant, categoryId })
      toast(
        res.queued
          ? `Saved offline · ${formatMinor(parsed.amountMinor, currency)} — will sync when you're back online`
          : `Saved ${formatMinor(parsed.amountMinor, currency)}${parsed.merchant ? ` · ${parsed.merchant}` : ''}`,
      )
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  const more = () => {
    openForm({
      type: parsed?.type,
      amountMinor: parsed?.amountMinor,
      currency,
      merchant: parsed?.merchant,
      category_id: categoryId,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='"coffee 15"  ·  "uber 32 usd"  ·  "+12000 salary"'
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="done"
          className="h-14 text-lg"
        />

        <div className="min-h-6 text-sm">
          {parsed ? (
            <span className={parsed.type === 'income' ? 'text-pos' : 'text-ink-2'}>
              {parsed.type === 'income' ? 'Income' : 'Expense'} ·{' '}
              <span className="font-semibold tabular-nums">{formatMinor(parsed.amountMinor, currency)}</span>
              {parsed.merchant && <> · {parsed.merchant}</>}
              {currency !== home && (
                <span className="text-muted">
                  {' '}
                  ≈ {formatMinor(convertMinor(parsed.amountMinor, currency, home, rate), home)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted">Amount + what it was. Add a currency code if it's not {home}.</span>
          )}
        </div>

        {parsed && (
          <CategoryPicker
            categories={categories}
            kind={kind}
            value={categoryId}
            onChange={(id) => {
              setTouchedCategory(true)
              setCategoryId(id)
            }}
          />
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={more} aria-label="More options">
            <SlidersHorizontal className="h-4 w-4" /> More
          </Button>
          <Button type="submit" disabled={!parsed || create.isPending} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
