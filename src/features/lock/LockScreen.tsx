import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete, Fingerprint } from 'lucide-react'
import { LogoTile } from '@/components/Logo'
import { cn } from '@/lib/cn'
import { verifyBiometric, verifyPin, clearLockSettings } from '@/lib/lock'
import { useLock } from './LockProvider'
import { useAuth } from '@/features/auth/AuthProvider'

const MAX_ATTEMPTS = 5
const COOLDOWN_S = 30

export function LockScreen() {
  const { settings, unlock } = useLock()
  const { signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [checking, setChecking] = useState(false)
  const triedBio = useRef(false)

  const tryBiometric = useCallback(async () => {
    if (!settings.biometricId) return
    const ok = await verifyBiometric(settings.biometricId)
    if (ok) unlock()
  }, [settings.biometricId, unlock])

  // Offer Face ID / fingerprint straight away, once.
  useEffect(() => {
    if (!triedBio.current && settings.biometricId) {
      triedBio.current = true
      const t = setTimeout(tryBiometric, 250)
      return () => clearTimeout(t)
    }
  }, [settings.biometricId, tryBiometric])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const submit = useCallback(
    async (candidate: string) => {
      setChecking(true)
      const ok = await verifyPin(candidate, settings)
      setChecking(false)
      if (ok) {
        setPin('')
        setAttempts(0)
        unlock()
        return
      }
      setError(true)
      setPin('')
      const n = attempts + 1
      setAttempts(n)
      if (n >= MAX_ATTEMPTS) {
        setCooldown(COOLDOWN_S)
        setAttempts(0)
      }
      if (navigator.vibrate) navigator.vibrate(80)
    },
    [attempts, settings, unlock],
  )

  const press = (d: string) => {
    if (checking || cooldown > 0) return
    setError(false)
    const next = (pin + d).slice(0, settings.pinLength)
    setPin(next)
    if (next.length === settings.pinLength) submit(next)
  }

  // Hardware keyboard support on desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const forgot = async () => {
    if (!confirm('Forgot your PIN? This signs you out and removes the lock on this device. You can sign back in with Google.')) return
    clearLockSettings()
    await signOut()
    location.reload()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col items-center justify-center px-6 safe-top safe-bottom select-none">
      <LogoTile className="mb-5" />
      <h1 className="text-lg font-semibold">Masari is locked</h1>
      <p className="mt-1 text-sm text-muted h-5">
        {cooldown > 0 ? `Too many tries · wait ${cooldown}s` : error ? 'Wrong PIN' : 'Enter your PIN'}
      </p>

      <div className={cn('mt-6 flex gap-3', error && 'animate-[shake_0.4s_ease-in-out]')}>
        {Array.from({ length: settings.pinLength }).map((_, i) => (
          <span key={i} className={cn('h-3.5 w-3.5 rounded-full border-2 transition-colors', i < pin.length ? 'bg-hero border-hero' : 'border-line-2')} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-[17rem]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={cooldown > 0}>
            {d}
          </Key>
        ))}
        <div className="flex items-center justify-center">
          {settings.biometricId && (
            <button onClick={tryBiometric} aria-label="Use biometrics" className="h-16 w-16 rounded-full flex items-center justify-center text-accent hover:bg-surface-2">
              <Fingerprint className="h-7 w-7" />
            </button>
          )}
        </div>
        <Key onClick={() => press('0')} disabled={cooldown > 0}>
          0
        </Key>
        <div className="flex items-center justify-center">
          <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete" className="h-16 w-16 rounded-full flex items-center justify-center text-ink-2 hover:bg-surface-2">
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>

      <button onClick={forgot} className="mt-10 text-xs text-muted hover:text-ink">
        Forgot PIN? Sign out
      </button>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

function Key({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 mx-auto rounded-full bg-surface border border-line text-2xl font-medium text-ink active:bg-surface-2 disabled:opacity-40 shadow-sm"
    >
      {children}
    </button>
  )
}
