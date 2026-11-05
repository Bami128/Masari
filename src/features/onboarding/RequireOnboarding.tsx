import { Navigate, Outlet } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { useProfile } from '@/features/profile/useProfile'

export function RequireOnboarding() {
  const { data: profile, isLoading, isError, error } = useProfile()

  if (isLoading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="min-h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-neg">Couldn't load your profile.</p>
        <p className="text-sm text-muted">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </main>
    )
  }

  if (!profile?.onboarded_at) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
