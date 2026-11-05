import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CloudOff, RefreshCw } from 'lucide-react'
import { flushOutbox, subscribeOutbox } from '@/lib/outbox'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Replays the offline outbox whenever we come back online (and on app start),
 * and shows a small status chip while anything is pending.
 */
export function SyncManager() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => subscribeOutbox(setPending), [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      const n = await flushOutbox()
      if (!cancelled && n > 0) qc.invalidateQueries({ queryKey: ['transactions', user.id] })
    }
    const onOnline = () => {
      setOnline(true)
      run()
    }
    const onOffline = () => setOnline(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    run()
    const timer = window.setInterval(run, 60_000)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [user, qc])

  if (online && pending === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-24 md:bottom-auto md:top-3 inset-x-0 z-[55] flex justify-center px-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-hero text-white text-xs font-medium px-3 py-1.5 shadow-lg">
        {online ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
        {online ? `Syncing ${pending}…` : pending > 0 ? `Offline · ${pending} saved locally` : 'Offline · showing saved data'}
      </div>
    </div>
  )
}
