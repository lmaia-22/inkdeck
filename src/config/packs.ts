import type { PackType, PackConfig } from '@/types/packs'
import type { DeckSize } from '@/types/deck'

export const PACK_CONFIGS: Record<`${PackType}_${DeckSize}`, PackConfig> = {
  simple_40: {
    packType: 'simple',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
    ],
  },
  simple_54: {
    packType: 'simple',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
    ],
  },
  duo_40: {
    packType: 'duo',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Card Front', description: 'Photo for all card fronts' },
    ],
  },
  duo_54: {
    packType: 'duo',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Card Front', description: 'Photo for all card fronts' },
    ],
  },
  signature_40: {
    packType: 'signature',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Numbered Cards', description: 'Photo for numbered cards (2-7)' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A (4 suits each). Slot order: J♠=0, J♥=1, J♦=2, J♣=3, Q♠=4 … A♣=15' },
    ],
  },
  signature_54: {
    packType: 'signature',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Numbered Cards', description: 'Photo for numbered cards (2-10)' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A (4 suits each). Slot order: J♠=0 … A♣=15' },
      { role: 'joker', count: 2, label: 'Jokers', description: '2 unique photos for the joker cards' },
    ],
  },
  full_custom_40: {
    packType: 'full_custom',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 24, label: 'Numbered Cards', description: '24 unique photos for 2-7 (4 suits each). Slot: rank_index×4 + suit_index' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A. Slot: rank_index×4 + suit_index' },
    ],
  },
  full_custom_54: {
    packType: 'full_custom',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 36, label: 'Numbered Cards', description: '36 unique photos for 2-10 (4 suits each). Slot: rank_index×4 + suit_index' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A. Slot: rank_index×4 + suit_index' },
      { role: 'joker', count: 2, label: 'Jokers', description: '2 unique photos for the joker cards' },
    ],
  },
}

export function getPackConfig(packType: PackType, deckSize: DeckSize): PackConfig {
  return PACK_CONFIGS[`${packType}_${deckSize}`]
}

export function getTotalPhotoCount(packType: PackType, deckSize: DeckSize): number {
  return getPackConfig(packType, deckSize).requirements.reduce((sum, r) => sum + r.count, 0)
}
