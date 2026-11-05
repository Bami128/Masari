import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { LogoTile } from '@/components/Logo'
import { Input, Label, Select } from '@/components/Field'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { CURRENCIES } from '@/lib/types'
import { toMinor } from '@/lib/money'
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'
import { useAccounts, useSetAccountBalance, useUpdateAccount } from '@/features/accounts/useAccounts'

export function OnboardingPage() {
  const { data: profile, isLoading } = useProfile()
  const update = useUpdateProfile()
  const navigate = useNavigate()
  const { toast } = useToast()

  const { data: accounts = [] } = useAccounts()
  const updateAccount = useUpdateAccount()
  const setBalance = useSetAccountBalance()
  const [currency, setCurrency] = useState('QAR')
  const [salaryDay, setSalaryDay] = useState('')
  const [budget, setBudget] = useState('')
  const [accountName, setAccountName] = useState('Main account')
  const [balance, setBalanceText] = useState('')

  if (isLoading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <Spinner />
      </main>
    )
  }
  if (profile?.onboarded_at) return <Navigate to="/" replace />

  const finish = async () => {
    const day = salaryDay ? Number(salaryDay) : null
    if (day !== null && (day < 1 || day > 31)) {
      toast('Salary day must be 1–31', 'error')
      return
    }
    const b = budget ? Number(budget.replace(/,/g, '')) : null
    if (b !== null && (!Number.isFinite(b) || b < 0)) {
      toast('Budget must be a number', 'error')
      return
    }
    const bal = balance.trim() ? Number(balance.replace(/,/g, '')) : null
    if (bal !== null && !Number.isFinite(bal)) {
      toast('Balance must be a number', 'error')
      return
    }
    try {
      const main = accounts[0]
      if (main) {
        await updateAccount.mutateAsync({ id: main.id, name: accountName.trim() || 'Main account', type: 'bank', currency, is_default: true })
        if (bal !== null) await setBalance.mutateAsync({ id: main.id, balance: toMinor(bal, currency) })
      }
      await update.mutateAsync({
        home_currency: currency,
        salary_day: day,
        monthly_budget: b !== null ? toMinor(b, currency) : null,
        onboarded_at: new Date().toISOString(),
      })
      navigate('/', { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    }
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-10 safe-top safe-bottom">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center text-center gap-3">
          <LogoTile />
          <h1 className="text-2xl font-semibold tracking-tight">Let's set you up</h1>
          <p className="text-muted text-sm">A few quick things. You can change them later in Settings.</p>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <Label>Home currency</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted">Everything gets totalled in this currency.</p>
          </div>

          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div>
              <Label>Main account</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. QNB" />
            </div>
            <div>
              <Label hint="optional">Balance now</Label>
              <Input inputMode="decimal" value={balance} onChange={(e) => setBalanceText(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label hint="optional">Salary day of the month</Label>
            <Input
              inputMode="numeric"
              placeholder="e.g. 25"
              value={salaryDay}
              onChange={(e) => setSalaryDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </div>

          <div>
            <Label hint="optional">Monthly spending budget ({currency})</Label>
            <Input
              inputMode="decimal"
              placeholder="e.g. 6000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">Powers the safe-to-spend number on your home screen.</p>
          </div>
        </div>

        <Button size="lg" onClick={finish} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Start tracking'}
        </Button>
      </div>
    </main>
  )
}
