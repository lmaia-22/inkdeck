import type { DeckSize } from './deck'

export type PackType = 'simple' | 'duo' | 'signature' | 'full_custom'
export type PhotoRole = 'back' | 'front' | 'face_ace' | 'joker'

export interface PhotoRequirement {
  role: PhotoRole
  count: number
  label: string
  description: string
}

export interface PackConfig {
  packType: PackType
  deckSize: DeckSize
  requirements: PhotoRequirement[]
}
