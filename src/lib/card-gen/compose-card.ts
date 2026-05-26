import sharp from 'sharp'
import type { Card } from '@/types/deck'
import { generateSvgOverlay } from './generate-svg-overlay'
import { MPC_SPEC } from '@/config/mpc-spec'

const { canvasWidth, canvasHeight } = MPC_SPEC

export async function composeCard(
  card: Card,
  artworkBuffer: Buffer | null,
  hasArtwork: boolean
): Promise<Buffer> {
  const svgString = generateSvgOverlay(card, { hasArtwork })
  const svgBuffer = Buffer.from(svgString)

  let base: ReturnType<typeof sharp>

  if (artworkBuffer && hasArtwork) {
    base = sharp(artworkBuffer).resize(canvasWidth, canvasHeight, { fit: 'cover' })
  } else {
    base = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 250, g: 250, b: 248, alpha: 1 },
      },
    })
  }

  return base
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer()
}
