import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { AppShell } from './AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { HomePage } from '@/features/home/HomePage'
import { TransactionsPage } from '@/features/transactions/TransactionsPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { RequireOnboarding } from '@/features/onboarding/RequireOnboarding'
import { BudgetsPage } from '@/features/budgets/BudgetsPage'
import { SubscriptionsPage } from '@/features/subscriptions/SubscriptionsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'transactions', element: <TransactionsPage /> },
              { path: 'budgets', element: <BudgetsPage /> },
              { path: 'reports', element: <Lazy><ReportsPage /></Lazy> },
              { path: 'subscriptions', element: <SubscriptionsPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
