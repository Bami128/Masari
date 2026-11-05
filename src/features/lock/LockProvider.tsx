import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadLockSettings, saveLockSettings, type LockSettings } from '@/lib/lock'
import { useAuth } from '@/features/auth/AuthProvider'

type Ctx = {
  settings: LockSettings
  update: (patch: Partial<LockSettings>) => void
  locked: boolean
  lock: () => void
  unlock: () => void
}

const LockContext = createContext<Ctx | null>(null)

export function LockProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [settings, setSettings] = useState<LockSettings>(() => loadLockSettings())
  const [locked, setLocked] = useState<boolean>(() => loadLockSettings().enabled)
  const hiddenAt = useRef<number | null>(null)

  const update = useCallback((patch: Partial<LockSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveLockSettings(next)
      return next
    })
  }, [])

  const lock = useCallback(() => {
    if (settings.enabled) setLocked(true)
  }, [settings.enabled])
  const unlock = useCallback(() => setLocked(false), [])

  // Re-lock after the app has been in the background for longer than the timeout.
  useEffect(() => {
    if (!settings.enabled) {
      setLocked(false)
      return
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        if (settings.timeout === 0) setLocked(true)
      } else if (hiddenAt.current !== null) {
        const away = (Date.now() - hiddenAt.current) / 1000
        hiddenAt.current = null
        if (away >= settings.timeout) setLocked(true)
      }
    }
    const onPageHide = () => {
      hiddenAt.current = Date.now()
      if (settings.timeout === 0) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [settings.enabled, settings.timeout])

  // Signed out (and auth has finished checking) → nothing to lock.
  useEffect(() => {
    if (!loading && !user) setLocked(false)
  }, [user, loading])

  const value = useMemo(() => ({ settings, update, locked: locked && Boolean(user) && settings.enabled, lock, unlock }), [settings, update, locked, user, lock, unlock])

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export function useLock(): Ctx {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error('useLock must be used inside <LockProvider>')
  return ctx
}
