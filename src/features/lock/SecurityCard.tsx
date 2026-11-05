import { useEffect, useState } from 'react'
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input, Label, Select } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { biometricAvailable, hashPin, registerBiometric, verifyPin, type LockTimeout } from '@/lib/lock'
import { useLock } from './LockProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'

export function SecurityCard() {
  const { settings, update, lock } = useLock()
  const { user } = useAuth()
  const { toast } = useToast()
  const [bioOk, setBioOk] = useState(false)
  const [mode, setMode] = useState<'idle' | 'set' | 'change'>('idle')
  const [current, setCurrent] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    biometricAvailable().then(setBioOk)
  }, [])

  const reset = () => {
    setMode('idle')
    setCurrent('')
    setPin1('')
    setPin2('')
  }

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(pin1)) return toast('PIN must be 4–6 digits', 'error')
    if (pin1 !== pin2) return toast("PINs don't match", 'error')
    if (/^(\d)\1+$/.test(pin1) || '0123456789'.includes(pin1) || '9876543210'.includes(pin1)) return toast('Pick a less obvious PIN', 'error')
    setBusy(true)
    try {
      if (mode === 'change' && !(await verifyPin(current, settings))) return toast('Current PIN is wrong', 'error')
      const { hash, salt } = await hashPin(pin1)
      update({ enabled: true, pinHash: hash, pinSalt: salt, pinLength: pin1.length })
      toast(mode === 'change' ? 'PIN changed' : 'App lock on')
      reset()
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!(await verifyPin(current, settings))) return toast('Current PIN is wrong', 'error')
    update({ enabled: false, pinHash: null, pinSalt: null, biometricId: null })
    toast('App lock off')
    reset()
  }

  const toggleBio = async () => {
    if (settings.biometricId) {
      update({ biometricId: null })
      return
    }
    try {
      const id = await registerBiometric(user?.id ?? 'masari', user?.email ?? 'Masari')
      update({ biometricId: id })
      toast('Biometric unlock on')
    } catch (e) {
      toast(e instanceof Error && e.name === 'NotAllowedError' ? 'Cancelled' : 'Could not set up biometrics on this device', 'error')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Security</CardTitle>
          <p className="text-xs text-muted mt-0.5">Lock the app on this device. Your PIN never leaves the phone.</p>
        </div>
        {settings.enabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pos bg-pos-soft rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5" /> On
          </span>
        ) : (
          <span className="text-xs font-medium text-muted bg-surface-2 rounded-full px-2.5 py-1">Off</span>
        )}
      </div>

      {!settings.enabled && mode === 'idle' && (
        <Button size="sm" className="mt-3" onClick={() => setMode('set')}>
          <Lock className="h-4 w-4" /> Turn on app lock
        </Button>
      )}

      {(mode === 'set' || mode === 'change') && (
        <div className="mt-3 rounded-xl border border-line p-3 flex flex-col gap-3">
          {mode === 'change' && (
            <div>
              <Label>Current PIN</Label>
              <Input inputMode="numeric" type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label hint="4–6 digits">New PIN</Label>
              <Input inputMode="numeric" type="password" autoComplete="new-password" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus={mode === 'set'} />
            </div>
            <div>
              <Label>Repeat</Label>
              <Input inputMode="numeric" type="password" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={savePin} disabled={busy}>
              {mode === 'change' ? 'Change PIN' : 'Enable'}
            </Button>
          </div>
        </div>
      )}

      {settings.enabled && mode === 'idle' && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-ink-2" /> Face ID / fingerprint
              </p>
              <p className="text-xs text-muted">{bioOk ? 'Unlock without typing the PIN' : 'Not available in this browser'}</p>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(settings.biometricId)}
              disabled={!bioOk}
              onClick={toggleBio}
              className={cn('relative h-7 w-12 rounded-full transition-colors disabled:opacity-40', settings.biometricId ? 'bg-accent' : 'bg-line-2')}
            >
              <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform', settings.biometricId ? 'translate-x-5.5' : 'translate-x-0.5')} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Lock after leaving the app</p>
              <p className="text-xs text-muted">How long before it asks again</p>
            </div>
            <Select value={String(settings.timeout)} onChange={(e) => update({ timeout: Number(e.target.value) as LockTimeout })} className="h-9 w-36 text-sm">
              <option value="0">Immediately</option>
              <option value="60">After 1 minute</option>
              <option value="300">After 5 minutes</option>
              <option value="900">After 15 minutes</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setMode('change')}>
              Change PIN
            </Button>
            <Button size="sm" variant="secondary" onClick={lock}>
              Lock now
            </Button>
            <DisableButton onDisable={disable} current={current} setCurrent={setCurrent} />
          </div>
        </div>
      )}
    </Card>
  )
}

function DisableButton({ onDisable, current, setCurrent }: { onDisable: () => void; current: string; setCurrent: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <Button size="sm" variant="ghost" className="text-neg" onClick={() => setOpen(true)}>
        Turn off
      </Button>
    )
  return (
    <div className="w-full flex items-center gap-2 mt-1">
      <Input inputMode="numeric" type="password" placeholder="Current PIN" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, '').slice(0, 6))} className="h-9 text-sm flex-1" autoFocus />
      <Button size="sm" variant="danger" onClick={onDisable}>
        Confirm off
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  )
}
