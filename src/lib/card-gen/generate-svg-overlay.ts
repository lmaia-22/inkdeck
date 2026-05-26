import type { Card } from '@/types/deck'

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  joker: '★',
}

const RED_SUITS = new Set<string>(['hearts', 'diamonds'])

function suitColor(suit: string): string {
  return RED_SUITS.has(suit) ? '#DC2626' : '#1a1a1a'
}

interface OverlayOptions {
  hasArtwork: boolean
}

export function generateSvgOverlay(card: Card, options: OverlayOptions): string {
  const { suit, rank } = card
  const { hasArtwork } = options
  const symbol = SUIT_SYMBOL[suit] ?? '?'
  const color = suitColor(suit)
  const isJoker = rank === 'JOKER'

  const bgRect = hasArtwork
    ? ''
    : `<rect width="825" height="1125" fill="#FAFAF8"/>`

  const cornerLabel = isJoker
    ? `<text font-size="28" fill="${color}" font-family="Arial, sans-serif" font-weight="bold">JOKER</text>`
    : `
      <text y="0" font-size="52" fill="${color}" font-family="Arial, sans-serif" font-weight="bold" dominant-baseline="hanging">${rank}</text>
      <text y="58" font-size="36" fill="${color}" font-family="Arial, sans-serif" dominant-baseline="hanging">${symbol}</text>
    `

  const borderRadius = 30
  const strokeColor = hasArtwork ? 'rgba(0,0,0,0.6)' : '#1a1a1a'

  return `<svg width="825" height="1125" xmlns="http://www.w3.org/2000/svg">
  ${bgRect}
  <rect x="12" y="12" width="801" height="1101" rx="${borderRadius}" ry="${borderRadius}"
    fill="none" stroke="${strokeColor}" stroke-width="3"/>
  <g transform="translate(28, 28)">
    ${cornerLabel}
  </g>
  <g transform="translate(825, 1125) rotate(180) translate(28, 28)">
    ${cornerLabel}
  </g>
</svg>`
}
