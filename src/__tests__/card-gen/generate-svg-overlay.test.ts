import { describe, it, expect } from 'vitest'
import { generateSvgOverlay } from '@/lib/card-gen/generate-svg-overlay'

describe('generateSvgOverlay', () => {
  it('returns a string starting with <svg', () => {
    const svg = generateSvgOverlay({ suit: 'spades', rank: 'A' }, { hasArtwork: true })
    expect(svg).toMatch(/^<svg/)
  })

  it('includes the rank text', () => {
    const svg = generateSvgOverlay({ suit: 'hearts', rank: 'Q' }, { hasArtwork: true })
    expect(svg).toContain('>Q<')
  })

  it('includes the spades symbol ♠ for spades', () => {
    const svg = generateSvgOverlay({ suit: 'spades', rank: '7' }, { hasArtwork: true })
    expect(svg).toContain('♠')
  })

  it('includes the hearts symbol ♥ for hearts', () => {
    const svg = generateSvgOverlay({ suit: 'hearts', rank: '7' }, { hasArtwork: true })
    expect(svg).toContain('♥')
  })

  it('includes red fill for hearts', () => {
    const svg = generateSvgOverlay({ suit: 'hearts', rank: '2' }, { hasArtwork: true })
    expect(svg).toContain('#DC2626')
  })

  it('includes red fill for diamonds', () => {
    const svg = generateSvgOverlay({ suit: 'diamonds', rank: '2' }, { hasArtwork: true })
    expect(svg).toContain('#DC2626')
  })

  it('has transparent background when hasArtwork is true', () => {
    const svg = generateSvgOverlay({ suit: 'clubs', rank: 'K' }, { hasArtwork: true })
    expect(svg).not.toContain('fill="#FAFAF8"')
  })

  it('has cream background when hasArtwork is false (Simple pack template)', () => {
    const svg = generateSvgOverlay({ suit: 'spades', rank: 'A' }, { hasArtwork: false })
    expect(svg).toContain('fill="#FAFAF8"')
  })

  it('includes JOKER text for joker cards', () => {
    const svg = generateSvgOverlay({ suit: 'joker', rank: 'JOKER' }, { hasArtwork: true })
    expect(svg).toContain('JOKER')
  })

  it('has correct SVG dimensions (825×1125)', () => {
    const svg = generateSvgOverlay({ suit: 'spades', rank: 'A' }, { hasArtwork: true })
    expect(svg).toContain('width="825"')
    expect(svg).toContain('height="1125"')
  })
})
