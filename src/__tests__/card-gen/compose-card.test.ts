import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBuffer = Buffer.from('fake-png-data')
const mockToBuffer = vi.fn().mockResolvedValue(mockBuffer)
const mockPng = vi.fn().mockReturnValue({ toBuffer: mockToBuffer })
const mockComposite = vi.fn().mockReturnValue({ png: mockPng })
const mockResize = vi.fn().mockReturnValue({ composite: mockComposite })
const mockSharpInstance = { resize: mockResize }

vi.mock('sharp', () => ({
  default: vi.fn((input?: Buffer | { create: object }) => {
    if (input && 'create' in (input as object)) return { composite: mockComposite }
    return mockSharpInstance
  }),
}))

import { composeCard } from '@/lib/card-gen/compose-card'

describe('composeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToBuffer.mockResolvedValue(mockBuffer)
    mockPng.mockReturnValue({ toBuffer: mockToBuffer })
    mockComposite.mockReturnValue({ png: mockPng })
    mockResize.mockReturnValue({ composite: mockComposite })
  })

  it('returns a Buffer', async () => {
    const result = await composeCard(
      { suit: 'spades', rank: 'A' },
      mockBuffer,
      true
    )
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('resizes artwork to 825×1125 when artwork is provided', async () => {
    await composeCard({ suit: 'spades', rank: 'A' }, mockBuffer, true)
    expect(mockResize).toHaveBeenCalledWith(825, 1125, { fit: 'cover' })
  })

  it('creates a blank canvas when no artwork (Simple pack front)', async () => {
    const sharp = await import('sharp')
    await composeCard({ suit: 'hearts', rank: 'K' }, null, false)
    expect(sharp.default).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.any(Object) })
    )
  })
})
