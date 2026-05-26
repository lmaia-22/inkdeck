import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildDeck } from '@/lib/card-gen/deck-builder'
import type { Order, OrderPhoto } from '@/types/database'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select()
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single<Order>()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const serviceSupabase = createServiceClient()
  const { data: photos } = await serviceSupabase
    .from('order_photos')
    .select()
    .eq('order_id', orderId)

  if (!photos) return NextResponse.json({ error: 'No photos found' }, { status: 404 })

  await serviceSupabase
    .from('orders')
    .update({ status: 'processing' })
    .eq('id', orderId)

  buildDeck(order, photos as OrderPhoto[]).catch(console.error)

  return NextResponse.json({ ok: true })
}
