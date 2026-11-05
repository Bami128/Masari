import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/Spinner'

// Google redirects here with ?code=... (PKCE). supabase-js exchanges it automatically
// because detectSessionInUrl is on; we just wait for the session and move on.
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error_description') ?? params.get('error')
    if (oauthError) {
      setError(oauthError)
      return
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        navigate('/', { replace: true })
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/', { replace: true })
    })

    return () => sub.subscription.unsubscribe()
  }, [navigate])

  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-4 px-6">
      {error ? (
        <>
          <p className="text-neg text-center">{error}</p>
          <button className="text-accent underline" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Spinner />
          <p className="text-muted">Signing you in…</p>
        </>
      )}
    </main>
  )
}
