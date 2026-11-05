import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000, // keep for a week so the persisted cache survives
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst', // serve cached data when offline instead of hanging
    },
    mutations: { networkMode: 'offlineFirst' },
  },
})

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'masari.query-cache.v1',
  throttleTime: 1000,
})

export const PERSIST_BUSTER = 'v0.5'
