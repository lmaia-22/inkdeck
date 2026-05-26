import { createServiceClient } from '@/lib/supabase/server'
import { getDeck } from '@/config/deck'
import { getPhotoForCard } from './get-photo-for-card'
import { composeCard } from './compose-card'
import type { Order, OrderPhoto } from '@/types/database'
import type { Card } from '@/types/deck'

const BATCH_SIZE = 5

async function downloadPhoto(storagePath: string): Promise<Buffer> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from('order-photos')
    .download(storagePath)

  if (error || !data) throw new Error(`Failed to download photo: ${storagePath}`)
  return Buffer.from(await data.arrayBuffer())
}

async function uploadCard(
  orderId: string,
  card: Card,
  face: 'front' | 'back',
  buffer: Buffer
): Promise<string> {
  const supabase = createServiceClient()
  const fileName = card.rank === 'JOKER'
    ? `${face}_joker_${card.jokerIndex ?? 0}.png`
    : `${face}_${card.suit}_${card.rank}.png`
  const path = `${orderId}/${fileName}`

  const { error } = await supabase.storage
    .from('order-cards')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new Error(`Failed to upload card: ${path}`)
  return path
}

async function buildCard(
  card: Card,
  order: Order,
  photos: OrderPhoto[]
): Promise<{ suit: string; rank: string; frontPath: string; backPath: string }> {
  const frontPhoto = getPhotoForCard(card, order.pack_type, order.deck_size, photos, 'front')
  const backPhoto = getPhotoForCard(card, order.pack_type, order.deck_size, photos, 'back')

  const frontBuffer = frontPhoto?.processed_path
    ? await downloadPhoto(frontPhoto.processed_path)
    : null

  const backBuffer = backPhoto?.processed_path
    ? await downloadPhoto(backPhoto.processed_path)
    : null

  const frontComposed = await composeCard(card, frontBuffer, frontBuffer !== null)
  const backComposed = await composeCard(
    card,
    backBuffer,
    backBuffer !== null
  )

  const frontPath = await uploadCard(order.id, card, 'front', frontComposed)
  const backPath = await uploadCard(order.id, card, 'back', backComposed)

  return { suit: card.suit, rank: card.rank, frontPath, backPath }
}

export async function buildDeck(order: Order, photos: OrderPhoto[]): Promise<void> {
  const supabase = createServiceClient()
  const cards = getDeck(order.deck_size)

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(card => buildCard(card, order, photos))
    )

    const rows = results.map(r => ({
      order_id: order.id,
      suit: r.suit,
      rank: r.rank,
      front_image_path: r.frontPath,
      back_image_path: r.backPath,
    }))

    const { error } = await supabase
      .from('order_cards')
      .upsert(rows, { onConflict: 'order_id,suit,rank' })

    if (error) throw new Error(`Failed to save order_cards batch: ${error.message}`)
  }

  const { error: statusError } = await supabase
    .from('orders')
    .update({ status: 'preview' })
    .eq('id', order.id)

  if (statusError) throw new Error(`Failed to update order status: ${statusError.message}`)
}
