import { createHmac } from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildDeck } from '@/lib/card-gen/deck-builder'
import type { Order, OrderPhoto } from '@/types/database'

function verifyReplicateSignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
  secret: string
): boolean {
  const message = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const computed = createHmac('sha256', secret).update(message).digest('base64')
  // Header may contain multiple signatures: "v1,<sig1> v1,<sig2>"
  return webhookSignature
    .split(' ')
    .some(part => {
      const [, sig] = part.split(',')
      return sig === computed
    })
}

export async function POST(request: Request) {
  const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const webhookId = request.headers.get('webhook-id') ?? ''
  const webhookTimestamp = request.headers.get('webhook-timestamp') ?? ''
  const webhookSignature = request.headers.get('webhook-signature') ?? ''

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 401 })
  }

  if (!verifyReplicateSignature(rawBody, webhookId, webhookTimestamp, webhookSignature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const { status, output } = body

  const url = new URL(request.url)
  const photoId = url.searchParams.get('photo_id')

  if (!photoId) {
    return NextResponse.json({ error: 'Missing photo_id' }, { status: 400 })
  }

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
    // Atomic CAS: only claim the order if it's still in 'draft' state.
    // If another webhook handler already claimed it, this returns no rows.
    const { data: claimedOrder } = await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', photo.order_id)
      .eq('status', 'draft')
      .select()
      .single<Order>()

    if (!claimedOrder) {
      // Another handler already claimed this order — skip to avoid double build
      return NextResponse.json({ ok: true })
    }

    const { data: allPhotos } = await supabase
      .from('order_photos')
      .select()
      .eq('order_id', photo.order_id)

    if (!allPhotos) {
      return NextResponse.json({ error: 'Failed to load photos for deck build' }, { status: 500 })
    }

    await buildDeck(claimedOrder, allPhotos as OrderPhoto[])
  }

  return NextResponse.json({ ok: true })
}
