// FX rates.
// Live rates come from open.er-api.com (free, no key, daily refresh), cached in
// localStorage. Until the first fetch succeeds — or if it never does — the static
// table below is used. Pegged Gulf currencies are exact either way.

const STATIC_PER_USD: Record<string, number> = {
  USD: 1,
  QAR: 3.64,
  AED: 3.6725,
  SAR: 3.75,
  BHD: 0.376,
  OMR: 0.3845,
  JOD: 0.709,
  KWD: 0.3075,
  LBP: 89500,
  EUR: 0.92,
  GBP: 0.78,
  EGP: 48,
  TRY: 40,
  INR: 84,
  PKR: 278,
  PHP: 58,
}

const PEGGED = new Set(['USD', 'QAR', 'AED', 'SAR', 'BHD', 'OMR', 'JOD', 'KWD'])
const CACHE_KEY = 'masari.fx.v1'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
export const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

export type FxSnapshot = { perUsd: Record<string, number>; fetchedAt: string; source: 'live' | 'static' }

let current: FxSnapshot = { perUsd: STATIC_PER_USD, fetchedAt: '', source: 'static' }

function loadCache(): FxSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as FxSnapshot
    if (!snap?.perUsd || typeof snap.perUsd.QAR !== 'number') return null
    return snap
  } catch {
    return null
  }
}

export function initFx(): FxSnapshot {
  const cached = loadCache()
  if (cached) current = cached
  return current
}

export function getFx(): FxSnapshot {
  return current
}

export function fxIsStale(snap: FxSnapshot = current): boolean {
  if (snap.source !== 'live') return true
  return Date.now() - new Date(snap.fetchedAt).getTime() > MAX_AGE_MS
}

/** Fetch fresh rates if the cache is older than a day. Resolves to the snapshot in use. */
export async function refreshFx(force = false): Promise<FxSnapshot> {
  if (!force && !fxIsStale()) return current
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return current
  try {
    const res = await fetch(FX_ENDPOINT, { cache: 'no-store' })
    if (!res.ok) throw new Error(`fx http ${res.status}`)
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (json.result !== 'success' || !json.rates || typeof json.rates.QAR !== 'number') throw new Error('fx bad payload')
    // Keep the exact pegs; the API's QAR/AED/etc. wobble in the 4th decimal.
    const perUsd: Record<string, number> = { ...json.rates }
    for (const c of PEGGED) if (STATIC_PER_USD[c]) perUsd[c] = STATIC_PER_USD[c]
    current = { perUsd, fetchedAt: new Date().toISOString(), source: 'live' }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(current))
    } catch {
      /* ignore */
    }
  } catch {
    /* keep whatever we had */
  }
  return current
}

/** How many `to` units one `from` unit buys, using the current snapshot. */
export function rate(from: string, to: string, snap: FxSnapshot = current): number {
  if (from === to) return 1
  const f = snap.perUsd[from.toUpperCase()] ?? STATIC_PER_USD[from.toUpperCase()]
  const t = snap.perUsd[to.toUpperCase()] ?? STATIC_PER_USD[to.toUpperCase()]
  if (!f || !t) return 1
  return t / f
}

/** @deprecated use rate() — kept so older call sites keep compiling */
export const fallbackRate = (from: string, to: string) => rate(from, to)

export function isPegged(currency: string): boolean {
  return PEGGED.has(currency.toUpperCase())
}
