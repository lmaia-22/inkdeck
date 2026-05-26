import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildDeck } from '@/lib/card-gen/deck-builder'
import type { Order, OrderPhoto } from '@/types/database'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const photoId = url.searchParams.get('photo_id')

  if (!photoId) {
    return NextResponse.json({ error: 'Missing photo_id' }, { status: 400 })
  }

  const body = await request.json()
  const { status, output } = body

  const supabase = createServiceClient()

  if (status === 'failed' || !output) {
    await supabase
      .from('order_photos')
      .update({ processing_status: 'failed' })
      .eq('id', photoId)
    return NextResponse.json({ ok: true })
  }

  const outputUrl: string = Array.isArray(output) ? output[0] : output

  const imageResponse = await fetch(outputUrl)
  if (!imageResponse.ok) {
    await supabase.from('order_photos').update({ processing_status: 'failed' }).eq('id', photoId)
    return NextResponse.json({ error: 'Could not fetch output image' }, { status: 500 })
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer())

  const { data: photo } = await supabase
    .from('order_photos')
    .select()
    .eq('id', photoId)
    .single<OrderPhoto>()

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  const processedPath = photo.original_path.replace(/\.[^.]+$/, '_processed.png')

  await supabase.storage
    .from('order-photos')
    .upload(processedPath, buffer, { contentType: 'image/png', upsert: true })

  await supabase
    .from('order_photos')
    .update({ processed_path: processedPath, processing_status: 'done' })
    .eq('id', photoId)

  const { data: remainingPhotos } = await supabase
    .from('order_photos')
    .select()
    .eq('order_id', photo.order_id)
    .neq('processing_status', 'done')

  if (!remainingPhotos || remainingPhotos.length === 0) {
    const { data: order } = await supabase
      .from('orders')
      .select()
      .eq('id', photo.order_id)
      .single<Order>()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const { data: allPhotos } = await supabase
      .from('order_photos')
      .select()
      .eq('order_id', photo.order_id)

    await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', order.id)

    await buildDeck(order, allPhotos as OrderPhoto[])
  }

  return NextResponse.json({ ok: true })
}
