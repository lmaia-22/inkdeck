import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Order } from '@/types/database'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  processing: 'Processing…',
  preview: 'Ready to Review',
  paid: 'Paid',
  submitted: 'Sent to Print',
  fulfilled: 'Fulfilled',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  processing: 'secondary',
  preview: 'default',
  paid: 'default',
  submitted: 'secondary',
  fulfilled: 'secondary',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Decks</h1>
        <Link href="/orders/new/configure">
          <Button>New Deck</Button>
        </Link>
      </div>

      {!orders?.length && (
        <p className="text-muted-foreground text-sm">
          No decks yet. Create your first one!
        </p>
      )}

      <div className="space-y-3">
        {orders?.map((order: Order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}/${order.status === 'draft' ? 'configure' : 'preview'}`}
            className="block"
          >
            <div className="border rounded-lg px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
              <div>
                <span className="font-medium capitalize">{order.pack_type.replace('_', ' ')}</span>
                <span className="text-muted-foreground text-sm ml-2">{order.deck_size} cards</span>
              </div>
              <Badge variant={STATUS_VARIANT[order.status]}>
                {STATUS_LABEL[order.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
