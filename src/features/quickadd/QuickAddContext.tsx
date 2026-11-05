import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Transaction } from '@/lib/types'
import type { TransactionDraft } from '@/features/transactions/TransactionSheet'

type State =
  | { mode: 'closed' }
  | { mode: 'quick' }
  | { mode: 'form'; draft?: TransactionDraft; editing?: Transaction }

type Ctx = {
  state: State
  openQuick: () => void
  openForm: (draft?: TransactionDraft) => void
  openEdit: (tx: Transaction) => void
  close: () => void
}

const QuickAddContext = createContext<Ctx | null>(null)

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ mode: 'closed' })

  const openQuick = useCallback(() => setState({ mode: 'quick' }), [])
  const openForm = useCallback((draft?: TransactionDraft) => setState({ mode: 'form', draft }), [])
  const openEdit = useCallback((tx: Transaction) => setState({ mode: 'form', editing: tx }), [])
  const close = useCallback(() => setState({ mode: 'closed' }), [])

  // Desktop shortcut: press N anywhere (not in an input) to open Quick Add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      setState({ mode: 'quick' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({ state, openQuick, openForm, openEdit, close }), [state, openQuick, openForm, openEdit, close])

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>
}

export function useQuickAdd(): Ctx {
  const ctx = useContext(QuickAddContext)
  if (!ctx) throw new Error('useQuickAdd must be used inside <QuickAddProvider>')
  return ctx
}
