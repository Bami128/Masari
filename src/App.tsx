import { RouterProvider } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { router } from '@/app/router'
import { queryClient, persister, PERSIST_BUSTER } from '@/app/queryClient'
import { ToastProvider } from '@/components/Toast'
import { QuickAddProvider } from '@/features/quickadd/QuickAddContext'
import { SyncManager } from '@/features/sync/SyncManager'
import { FxProvider } from '@/features/fx/FxProvider'
import { LockProvider } from '@/features/lock/LockProvider'
import { LockGate } from '@/features/lock/LockGate'

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: PERSIST_BUSTER,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // Only persist successful reads; never mutations or errors.
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      <AuthProvider>
        <LockProvider>
          <FxProvider>
            <ToastProvider>
              <QuickAddProvider>
                <SyncManager />
                <RouterProvider router={router} />
                <LockGate />
              </QuickAddProvider>
            </ToastProvider>
          </FxProvider>
        </LockProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}
