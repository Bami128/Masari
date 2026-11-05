import { Repeat } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'

export function SubscriptionsPage() {
  return (
    <>
      <PageHeader title="Subscriptions" />
      <Card>
        <EmptyState icon={Repeat} title="No recurring charges detected" body="Coming in Phase 3." />
      </Card>
    </>
  )
}
