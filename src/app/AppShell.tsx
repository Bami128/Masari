import { NavLink, Outlet } from 'react-router-dom'
import { Home, List, Plus, PieChart, Settings, Target } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/Button'
import { LogoTile } from '@/components/Logo'
import { useQuickAdd } from '@/features/quickadd/QuickAddContext'
import { QuickAddSheet } from '@/features/quickadd/QuickAddSheet'
import { TransactionSheet } from '@/features/transactions/TransactionSheet'

const primaryNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/transactions', label: 'Transactions', icon: List },
  { to: '/budgets', label: 'Budget', icon: Target },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const mobileNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/transactions', label: 'Activity', icon: List },
  null,
  { to: '/budgets', label: 'Budget', icon: Target },
  { to: '/reports', label: 'Reports', icon: PieChart },
] as const

export function AppShell() {
  const { user, signOut } = useAuth()
  const { state, openQuick, close } = useQuickAdd()

  return (
    <div className="min-h-full flex bg-bg">
      {/* Sidebar (≥ md) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16">
          <LogoTile size="sm" />
          <span className="font-semibold tracking-tight text-ink">Masari</span>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
          {primaryNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 h-11 text-sm transition-colors',
                  isActive ? 'bg-accent-soft text-accent-2 font-medium' : 'text-ink-2 hover:bg-surface-2',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 flex flex-col gap-2 border-t border-line">
          <Button onClick={openQuick} className="w-full">
            <Plus className="h-4 w-4" /> Quick add
            <kbd className="ml-auto text-[10px] font-mono bg-white/15 rounded px-1.5 py-0.5">N</kbd>
          </Button>
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-muted truncate">{user?.email}</span>
            <button onClick={signOut} className="text-xs text-muted hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-4 md:px-8 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-8 pb-28 md:pb-10 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar (< md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur safe-bottom">
        <div className="grid grid-cols-5 h-16 items-center">
          {mobileNav.map((item) =>
            item === null ? (
              <div key="add" className="flex justify-center">
                <button
                  onClick={openQuick}
                  aria-label="Quick add"
                  className="-mt-7 h-14 w-14 rounded-full bg-hero text-white shadow-lg shadow-hero/25 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Plus className="h-7 w-7" />
                </button>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] h-full',
                    isActive ? 'text-accent-2 font-medium' : 'text-muted',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ),
          )}
        </div>
      </nav>

      <QuickAddSheet open={state.mode === 'quick'} onClose={close} />
      <TransactionSheet
        open={state.mode === 'form'}
        onClose={close}
        draft={state.mode === 'form' ? state.draft : undefined}
        editing={state.mode === 'form' ? state.editing : undefined}
      />
    </div>
  )
}
