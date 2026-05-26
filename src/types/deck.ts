export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type JokerSuit = 'joker'
export type AnySuit = Suit | JokerSuit

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type JokerRank = 'JOKER'
export type AnyRank = Rank | JokerRank

export type DeckSize = 40 | 54

export interface Card {
  suit: AnySuit
  rank: AnyRank
  jokerIndex?: 0 | 1
}
