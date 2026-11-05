// Offline outbox for Quick Add.
// A transaction that can't reach Supabase is parked here (localStorage) and
// replayed when the network is back. Rows carry a client-generated UUID, so a
// replay that already landed just hits the primary key and is treated as done.

import { supabase } from './supabase'
import type { TransactionInput } from '@/features/transactions/useTransactions'

const KEY = 'masari.outbox.v1'

export type OutboxItem = { id: string; user_id: string; payload: TransactionInput; queued_at: string }

type Listener = (count: number) => void
const listeners = new Set<Listener>()

function read(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as OutboxItem[]) : []
  } catch {
    return []
  }
}

function write(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage full or blocked — nothing sensible to do */
  }
  for (const l of listeners) l(items.length)
}

export function outboxCount(): number {
  return read().length
}

export function subscribeOutbox(l: Listener): () => void {
  listeners.add(l)
  l(read().length)
  return () => {
    listeners.delete(l)
  }
}

export function enqueue(item: OutboxItem) {
  const items = read()
  if (!items.some((i) => i.id === item.id)) items.push(item)
  write(items)
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(msg)
}

let flushing = false

/** Replay queued rows. Returns how many were delivered. */
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0
  const items = read()
  if (items.length === 0) return 0
  flushing = true
  let delivered = 0
  try {
    const remaining: OutboxItem[] = []
    for (const item of items) {
      const { error } = await supabase.from('transactions').insert({ id: item.id, user_id: item.user_id, ...item.payload })
      if (!error || error.code === '23505') {
        delivered++
        continue
      }
      if (isNetworkError(error)) {
        remaining.push(item)
        continue
      }
      // A real server rejection (bad data, RLS) — drop it rather than retry forever.
      console.warn('Outbox item rejected and dropped', item.id, error.message)
    }
    // Keep anything queued while we were flushing.
    const now = read()
    const nowIds = new Set(now.map((i) => i.id))
    const merged = [...remaining, ...now.filter((i) => !items.some((x) => x.id === i.id) && nowIds.has(i.id))]
    write(merged)
  } finally {
    flushing = false
  }
  return delivered
}
