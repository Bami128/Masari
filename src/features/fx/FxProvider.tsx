import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getFx, initFx, rate as rateFor, refreshFx, type FxSnapshot } from '@/lib/fx'

type Ctx = {
  snapshot: FxSnapshot
  rate: (from: string, to: string) => number
  refresh: () => Promise<void>
  refreshing: boolean
}

const FxContext = createContext<Ctx | null>(null)

export function FxProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<FxSnapshot>(() => initFx())
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setSnapshot(await refreshFx(true))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    refreshFx().then((s) => !cancelled && setSnapshot(s))
    const onOnline = () => refreshFx().then((s) => !cancelled && setSnapshot(s))
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => refreshFx().then((s) => !cancelled && setSnapshot(s)), 60 * 60 * 1000)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [])

  const value = useMemo<Ctx>(
    () => ({ snapshot, rate: (f, t) => rateFor(f, t, snapshot), refresh, refreshing }),
    [snapshot, refresh, refreshing],
  )

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>
}

export function useFx(): Ctx {
  const ctx = useContext(FxContext)
  if (!ctx) {
    // Outside the provider (tests, storybook) — fall back to the module snapshot.
    const snap = getFx()
    return { snapshot: snap, rate: (f, t) => rateFor(f, t, snap), refresh: async () => {}, refreshing: false }
  }
  return ctx
}
