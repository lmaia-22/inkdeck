import { describe, it, expect } from 'vitest'
import { getPhotoForCard } from '@/lib/card-gen/get-photo-for-card'
import type { OrderPhoto } from '@/types/database'

function makePhoto(overrides: Partial<OrderPhoto>): OrderPhoto {
  return {
    id: 'photo-id',
    order_id: 'order-id',
    role: 'back',
    slot_index: 0,
    original_path: 'original/path.jpg',
    processed_path: 'processed/path.jpg',
    replicate_prediction_id: null,
    processing_status: 'done',
    ...overrides,
  }
}

const backPhoto = makePhoto({ role: 'back', slot_index: 0 })
const frontPhoto = makePhoto({ role: 'front', slot_index: 0 })

describe('simple pack', () => {
  it('returns back photo for back face', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: 'A' },
      'simple', 40,
      [backPhoto],
      'back'
    )
    expect(result).toEqual(backPhoto)
  })

  it('returns null for all front faces (standard template)', () => {
    const result = getPhotoForCard(
      { suit: 'hearts', rank: 'Q' },
      'simple', 40,
      [backPhoto],
      'front'
    )
    expect(result).toBeNull()
  })
})

describe('duo pack', () => {
  it('returns front photo for any front card', () => {
    const result = getPhotoForCard(
      { suit: 'diamonds', rank: 'K' },
      'duo', 40,
      [backPhoto, frontPhoto],
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })

  it('returns back photo for back face', () => {
    const result = getPhotoForCard(
      { suit: 'clubs', rank: '7' },
      'duo', 40,
      [backPhoto, frontPhoto],
      'back'
    )
    expect(result).toEqual(backPhoto)
  })

  it('returns front photo for joker in 54-card deck', () => {
    const result = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
      'duo', 54,
      [backPhoto, frontPhoto],
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })
})

describe('signature pack', () => {
  const frontPhoto = makePhoto({ role: 'front', slot_index: 0 })
  const jspadesPhoto = makePhoto({ role: 'face_ace', slot_index: 0 }) // J♠
  const qheartsPhoto = makePhoto({ role: 'face_ace', slot_index: 5 }) // Q♥ = 1*4+1
  const aclubsPhoto = makePhoto({ role: 'face_ace', slot_index: 15 }) // A♣ = 3*4+3

  const photos = [backPhoto, frontPhoto, jspadesPhoto, qheartsPhoto, aclubsPhoto]

  it('returns front photo for numbered card', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: '5' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })

  it('returns slot-0 face_ace photo for J♠', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: 'J' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(jspadesPhoto)
  })

  it('returns slot-5 face_ace photo for Q♥', () => {
    const result = getPhotoForCard(
      { suit: 'hearts', rank: 'Q' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(qheartsPhoto)
  })

  it('returns slot-15 face_ace photo for A♣', () => {
    const result = getPhotoForCard(
      { suit: 'clubs', rank: 'A' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(aclubsPhoto)
  })

  it('returns joker photo by jokerIndex for 54-card deck', () => {
    const joker0 = makePhoto({ role: 'joker', slot_index: 0 })
    const joker1 = makePhoto({ role: 'joker', slot_index: 1 })
    const result0 = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
      'signature', 54,
      [...photos, joker0, joker1],
      'front'
    )
    const result1 = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 1 },
      'signature', 54,
      [...photos, joker0, joker1],
      'front'
    )
    expect(result0).toEqual(joker0)
    expect(result1).toEqual(joker1)
  })
})

describe('full_custom pack', () => {
  it('returns unique photo for each numbered card in 40-card deck', () => {
    // 2♠ = slot 0, 2♥ = slot 1
    const twoSpades = makePhoto({ role: 'front', slot_index: 0 })
    const twoHearts = makePhoto({ role: 'front', slot_index: 1 })
    const photos = [backPhoto, twoSpades, twoHearts]

    expect(
      getPhotoForCard({ suit: 'spades', rank: '2' }, 'full_custom', 40, photos, 'front')
    ).toEqual(twoSpades)

    expect(
      getPhotoForCard({ suit: 'hearts', rank: '2' }, 'full_custom', 40, photos, 'front')
    ).toEqual(twoHearts)
  })

  it('returns unique photo for each numbered card in 54-card deck', () => {
    // 10♣ = slot 8*4+3 = 35
    const tenClubs = makePhoto({ role: 'front', slot_index: 35 })
    const photos = [backPhoto, tenClubs]

    expect(
      getPhotoForCard({ suit: 'clubs', rank: '10' }, 'full_custom', 54, photos, 'front')
    ).toEqual(tenClubs)
  })
})
