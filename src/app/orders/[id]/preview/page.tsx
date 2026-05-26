import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Order, OrderCard } from '@/types/database'

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select()
    .eq('id', id)
    .single<Order>()

  if (!order) redirect('/')

  if (order.status === 'processing' || order.status === 'draft') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">Generating your deck…</div>
          <p className="text-sm text-muted-foreground">
            This usually takes 1–3 minutes. Refresh the page to check progress.
          </p>
          <Badge variant="secondary">{order.status}</Badge>
        </div>
      </div>
    )
  }

  const { data: cards } = await supabase
    .from('order_cards')
    .select()
    .eq('order_id', id)
    .order('suit')
    .order('rank')

  const { data: { publicUrl: baseUrl } } = supabase.storage
    .from('order-cards')
    .getPublicUrl('')

  return (
    <div className="min-h-screen bg-[#FAFAF8] max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your deck preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cards?.length} cards · {order.pack_type.replace('_', ' ')} · {order.deck_size}-card deck
          </p>
        </div>
        <Badge>{order.status}</Badge>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {cards?.map((card: OrderCard) => {
          const cardKey = card.rank === 'JOKER'
            ? `joker-${card.id}`
            : `${card.suit}-${card.rank}`
          return (
            <div key={cardKey} className="aspect-[5.5/8.5] rounded overflow-hidden border bg-white">
              {card.front_image_path ? (
                <img
                  src={`${baseUrl}/${card.front_image_path}`}
                  alt={`${card.rank} of ${card.suit}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  {card.rank} {card.suit.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {order.status === 'preview' && (
        <div className="pt-4">
          <Button className="w-full" size="lg" disabled>
            Proceed to checkout (Stripe coming soon)
          </Button>
        </div>
      )}
    </div>
  )
}
