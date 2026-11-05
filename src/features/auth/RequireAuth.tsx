import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '@/components/Spinner'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
