'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { PackType } from '@/types/packs'
import type { DeckSize } from '@/types/deck'

const PACK_OPTIONS: { value: PackType; label: string; description: string }[] = [
  { value: 'simple', label: 'Simple', description: '1 photo for card backs. Fronts use the InkDeck template.' },
  { value: 'duo', label: 'Duo', description: '2 photos: one for backs, one for all fronts.' },
  { value: 'signature', label: 'Signature', description: '18–20 photos: backs, numbered cards, and unique face/ace cards.' },
  { value: 'full_custom', label: 'Full Custom', description: '41–55 photos: every single card gets its own unique image.' },
]

const SIZE_OPTIONS: { value: DeckSize; label: string; description: string }[] = [
  { value: 40, label: '40 cards', description: 'A, 2–7, J, Q, K — classic Italian-style deck.' },
  { value: 54, label: '54 cards', description: 'A, 2–10, J, Q, K + 2 Jokers — standard deck.' },
]

export default function ConfigurePage() {
  const [packType, setPackType] = useState<PackType | null>(null)
  const [deckSize, setDeckSize] = useState<DeckSize | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleCreate() {
    if (!packType || !deckSize) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack_type: packType, deck_size: deckSize }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create order')
      setLoading(false)
      return
    }

    const { order } = await res.json()
    router.push(`/orders/${order.id}/upload`)
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] max-w-2xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Configure your deck</h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Pack type</h2>
        <div className="grid grid-cols-1 gap-3">
          {PACK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPackType(opt.value)}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                packType === opt.value
                  ? 'border-black bg-black text-white'
                  : 'border-border hover:bg-accent/30'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className={`text-sm mt-0.5 ${packType === opt.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Deck size</h2>
        <div className="grid grid-cols-2 gap-3">
          {SIZE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDeckSize(opt.value)}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                deckSize === opt.value
                  ? 'border-black bg-black text-white'
                  : 'border-border hover:bg-accent/30'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className={`text-sm mt-0.5 ${deckSize === opt.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={handleCreate}
        disabled={!packType || !deckSize || loading}
        className="w-full"
      >
        {loading ? 'Creating…' : 'Continue to upload'}
      </Button>
    </div>
  )
}
