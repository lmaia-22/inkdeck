import { describe, it, expect } from 'vitest'
import { DECK_40, DECK_54, getDeck, SUITS, RANKS_40, RANKS_54 } from '@/config/deck'

describe('DECK_40', () => {
  it('has exactly 40 cards', () => {
    expect(DECK_40).toHaveLength(40)
  })

  it('contains no 8, 9, or 10', () => {
    const ranks = DECK_40.map(c => c.rank)
    expect(ranks).not.toContain('8')
    expect(ranks).not.toContain('9')
    expect(ranks).not.toContain('10')
  })

  it('contains A, 2-7, J, Q, K for each suit', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS_40) {
        expect(DECK_40).toContainEqual({ suit, rank })
      }
    }
  })

  it('has no jokers', () => {
    expect(DECK_40.filter(c => c.rank === 'JOKER')).toHaveLength(0)
  })
})

describe('DECK_54', () => {
  it('has exactly 54 cards', () => {
    expect(DECK_54).toHaveLength(54)
  })

  it('contains 2 jokers with jokerIndex 0 and 1', () => {
    const jokers = DECK_54.filter(c => c.rank === 'JOKER')
    expect(jokers).toHaveLength(2)
    expect(jokers[0].jokerIndex).toBe(0)
    expect(jokers[1].jokerIndex).toBe(1)
  })

  it('contains all 13 ranks for each suit', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS_54) {
        expect(DECK_54).toContainEqual({ suit, rank })
      }
    }
  })
})

describe('getDeck', () => {
  it('returns DECK_40 for size 40', () => {
    expect(getDeck(40)).toBe(DECK_40)
  })

  it('returns DECK_54 for size 54', () => {
    expect(getDeck(54)).toBe(DECK_54)
  })
})
