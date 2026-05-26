import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processPhotoAsync } from '@/lib/replicate/process-photo'
import type { PhotoRole } from '@/types/packs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select()
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'draft') {
    return NextResponse.json({ error: 'Order is not in draft state' }, { status: 409 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const role = formData.get('role') as PhotoRole
  const slotIndex = parseInt(formData.get('slot_index') as string ?? '0', 10)

  if (!file || !role) {
    return NextResponse.json({ error: 'Missing file or role' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${orderId}/${role}_${slotIndex}.${ext}`

  const { error: uploadError } = await serviceSupabase.storage
    .from('order-photos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: photo, error: insertError } = await serviceSupabase
    .from('order_photos')
    .upsert({
      order_id: orderId,
      role,
      slot_index: slotIndex,
      original_path: storagePath,
      processing_status: 'pending',
    }, { onConflict: 'order_id,role,slot_index' })
    .select()
    .single()

  if (insertError || !photo) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // TODO: remove this bypass once Replicate account has credits.
  // Skips AI processing and uses the original photo directly as the processed image.
  const BYPASS_REPLICATE = true

  if (BYPASS_REPLICATE) {
    await serviceSupabase
      .from('order_photos')
      .update({ processed_path: storagePath, processing_status: 'done' })
      .eq('id', photo.id)
    return NextResponse.json({ photo: { ...photo, processed_path: storagePath, processing_status: 'done' } }, { status: 201 })
  }

  const { data: signedData, error: signError } = await serviceSupabase.storage
    .from('order-photos')
    .createSignedUrl(storagePath, 300)

  if (signError || !signedData) {
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }

  const imageUrl = signedData.signedUrl
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate?photo_id=${photo.id}`

  try {
    const predictionId = await processPhotoAsync({
      imageUrl,
      photoId: photo.id,
      webhookUrl,
    })

    await serviceSupabase
      .from('order_photos')
      .update({ replicate_prediction_id: predictionId, processing_status: 'processing' })
      .eq('id', photo.id)
  } catch (err) {
    console.error('[photos] Replicate error:', err)
    await serviceSupabase
      .from('order_photos')
      .update({ processing_status: 'failed' })
      .eq('id', photo.id)
    return NextResponse.json({ error: 'AI processing failed to start', detail: String(err) }, { status: 500 })
  }

  return NextResponse.json({ photo }, { status: 201 })
}
