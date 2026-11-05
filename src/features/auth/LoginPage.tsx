import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/Button'
import { LogoTile } from '@/components/Logo'

export function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user) return <Navigate to="/" replace />

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setBusy(false)
    }
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <LogoTile size="lg" className="shadow-lg shadow-hero/20" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Masari</h1>
            <p className="mt-2 text-muted">
              Know what you can spend today. Simple, private, multi-currency.
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleGoogle}
            disabled={busy || !isSupabaseConfigured}
            className="w-full"
          >
            <GoogleMark />
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          {!isSupabaseConfigured && (
            <p className="text-xs text-warn">
              Supabase isn't configured yet — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </p>
          )}
          {error && <p className="text-sm text-neg">{error}</p>}
        </div>

        <p className="text-xs text-muted">
          Your data is yours. No bank logins, no selling data, ever.
        </p>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.2 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  )
}
