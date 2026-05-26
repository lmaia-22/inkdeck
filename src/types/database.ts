import type { PackType, PhotoRole } from './packs'
import type { AnySuit, AnyRank, DeckSize } from './deck'

export type OrderStatus =
  | 'draft'
  | 'processing'
  | 'preview'
  | 'paid'
  | 'submitted'
  | 'fulfilled'

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Order {
  id: string
  user_id: string
  pack_type: PackType
  deck_size: DeckSize
  status: OrderStatus
  stripe_payment_intent_id: string | null
  mpc_order_id: string | null
  created_at: string
}

export interface OrderPhoto {
  id: string
  order_id: string
  role: PhotoRole
  slot_index: number
  original_path: string
  processed_path: string | null
  replicate_prediction_id: string | null
  processing_status: ProcessingStatus
}

export interface OrderCard {
  id: string
  order_id: string
  suit: AnySuit
  rank: AnyRank
  front_image_path: string
  back_image_path: string
}
