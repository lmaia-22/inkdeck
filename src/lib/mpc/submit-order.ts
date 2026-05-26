import { createServiceClient } from '@/lib/supabase/server'
import type { Order } from '@/types/database'

export async function submitOrderToMpc(order: Order): Promise<string> {
  const supabase = createServiceClient()

  const { data: cards } = await supabase
    .from('order_cards')
    .select()
    .eq('order_id', order.id)

  if (!cards || cards.length === 0) {
    throw new Error('No order_cards found for order')
  }

  console.log(`[MPC STUB] Submitting order ${order.id} with ${cards.length} cards`)
  console.log(`[MPC STUB] Pack: ${order.pack_type}, Size: ${order.deck_size}`)

  const stubMpcOrderId = `MPC-STUB-${order.id.slice(0, 8).toUpperCase()}`

  await supabase
    .from('orders')
    .update({ status: 'submitted', mpc_order_id: stubMpcOrderId })
    .eq('id', order.id)

  return stubMpcOrderId
}
