import type { Card, Suit, DeckSize } from '@/types/deck'

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export const RANKS_40 = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'] as const
export const RANKS_54 = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export const DECK_40: Card[] = SUITS.flatMap(suit =>
  RANKS_40.map(rank => ({ suit, rank }))
)

export const DECK_54: Card[] = [
  ...SUITS.flatMap(suit => RANKS_54.map(rank => ({ suit, rank }))),
  { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
  { suit: 'joker', rank: 'JOKER', jokerIndex: 1 },
]

export function getDeck(size: DeckSize): Card[] {
  return size === 40 ? DECK_40 : DECK_54
}
