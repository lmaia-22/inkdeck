export const MPC_SPEC = {
  canvasWidth: 825,
  canvasHeight: 1125,
  safeZoneWidth: 750,
  safeZoneHeight: 1050,
  bleed: 37.5,
  dpi: 300,
  colorSpace: 'srgb' as const,
  format: 'png' as const,
} as const

export type MpcSpec = typeof MPC_SPEC
