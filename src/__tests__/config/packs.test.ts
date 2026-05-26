import { describe, it, expect } from 'vitest'
import { getPackConfig, getTotalPhotoCount, PACK_CONFIGS } from '@/config/packs'

describe('getPackConfig', () => {
  it('simple_40 requires 1 photo (back only)', () => {
    const config = getPackConfig('simple', 40)
    expect(config.requirements).toHaveLength(1)
    expect(config.requirements[0].role).toBe('back')
    expect(config.requirements[0].count).toBe(1)
  })

  it('duo_40 requires 2 photos (back + front)', () => {
    const config = getPackConfig('duo', 40)
    expect(getTotalPhotoCount('duo', 40)).toBe(2)
    expect(config.requirements.map(r => r.role)).toEqual(['back', 'front'])
  })

  it('signature_40 requires 18 photos total', () => {
    expect(getTotalPhotoCount('signature', 40)).toBe(18)
  })

  it('signature_54 requires 20 photos total', () => {
    expect(getTotalPhotoCount('signature', 54)).toBe(20)
  })

  it('full_custom_40 requires 41 photos total', () => {
    expect(getTotalPhotoCount('full_custom', 40)).toBe(41)
  })

  it('full_custom_54 requires 55 photos total', () => {
    expect(getTotalPhotoCount('full_custom', 54)).toBe(55)
  })

  it('full_custom_40 has 24 numbered card slots', () => {
    const config = getPackConfig('full_custom', 40)
    const front = config.requirements.find(r => r.role === 'front')!
    expect(front.count).toBe(24)
  })

  it('full_custom_54 has 36 numbered card slots', () => {
    const config = getPackConfig('full_custom', 54)
    const front = config.requirements.find(r => r.role === 'front')!
    expect(front.count).toBe(36)
  })
})

describe('PACK_CONFIGS completeness', () => {
  it('covers all 8 pack+size combinations', () => {
    const keys = Object.keys(PACK_CONFIGS)
    expect(keys).toHaveLength(8)
  })
})
