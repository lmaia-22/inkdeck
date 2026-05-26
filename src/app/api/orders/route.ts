import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PackType } from '@/types/packs'
import type { DeckSize } from '@/types/deck'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { pack_type, deck_size } = body as { pack_type: PackType; deck_size: DeckSize }

  if (!['simple', 'duo', 'signature', 'full_custom'].includes(pack_type)) {
    return NextResponse.json({ error: 'Invalid pack_type' }, { status: 400 })
  }
  if (deck_size !== 40 && deck_size !== 54) {
    return NextResponse.json({ error: 'Invalid deck_size' }, { status: 400 })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({ user_id: user.id, pack_type, deck_size, status: 'draft' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ order }, { status: 201 })
}
