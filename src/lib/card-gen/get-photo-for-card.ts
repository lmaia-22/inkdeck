import type { Card } from '@/types/deck'
import type { PackType } from '@/types/packs'
import type { OrderPhoto } from '@/types/database'
import type { PhotoRole } from '@/types/packs'

const SUIT_INDEX: Record<string, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
}

const FACE_ACE_RANK_INDEX: Record<string, number> = {
  J: 0,
  Q: 1,
  K: 2,
  A: 3,
}

const NUMBERED_40_RANK_INDEX: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5,
}

const NUMBERED_54_RANK_INDEX: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4,
  '7': 5, '8': 6, '9': 7, '10': 8,
}

function find(photos: OrderPhoto[], role: PhotoRole, slotIndex = 0): OrderPhoto | null {
  return photos.find(p => p.role === role && p.slot_index === slotIndex) ?? null
}

function faceAceSlot(card: Card): number {
  return FACE_ACE_RANK_INDEX[card.rank] * 4 + SUIT_INDEX[card.suit]
}

function numberedSlot(card: Card, deckSize: 40 | 54): number {
  const index = deckSize === 40
    ? NUMBERED_40_RANK_INDEX[card.rank]
    : NUMBERED_54_RANK_INDEX[card.rank]
  return index * 4 + SUIT_INDEX[card.suit]
}

export function getPhotoForCard(
  card: Card,
  packType: PackType,
  deckSize: 40 | 54,
  photos: OrderPhoto[],
  face: 'front' | 'back'
): OrderPhoto | null {
  if (face === 'back') return find(photos, 'back', 0)

  if (card.rank === 'JOKER') {
    if (packType === 'simple') return null
    if (packType === 'duo') return find(photos, 'front', 0)
    return find(photos, 'joker', card.jokerIndex ?? 0)
  }

  if (card.rank in FACE_ACE_RANK_INDEX) {
    if (packType === 'simple') return null
    if (packType === 'duo') return find(photos, 'front', 0)
    return find(photos, 'face_ace', faceAceSlot(card))
  }

  switch (packType) {
    case 'simple': return null
    case 'duo': return find(photos, 'front', 0)
    case 'signature': return find(photos, 'front', 0)
    case 'full_custom': return find(photos, 'front', numberedSlot(card, deckSize))
  }
}
