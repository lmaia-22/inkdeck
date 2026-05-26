'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getPackConfig } from '@/config/packs'
import type { PackType } from '@/types/packs'
import type { DeckSize } from '@/types/deck'
import type { Order } from '@/types/database'

interface SlotState {
  role: string
  slotIndex: number
  label: string
  description: string
  status: 'empty' | 'uploading' | 'done' | 'error'
  fileName?: string
}

export default function UploadPage() {
  const params = useParams()
  const orderId = params.id as string
  const router = useRouter()
  const [slots, setSlots] = useState<SlotState[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeSlot, setActiveSlot] = useState<{ role: string; index: number } | null>(null)

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(({ order }: { order: Order }) => {
        const config = getPackConfig(order.pack_type as PackType, order.deck_size as DeckSize)
        setSlots(
          config.requirements.flatMap(req =>
            Array.from({ length: req.count }, (_, i) => ({
              role: req.role,
              slotIndex: i,
              label: req.count === 1 ? req.label : `${req.label} #${i + 1}`,
              description: req.description,
              status: 'empty' as const,
            }))
          )
        )
      })
  }, [orderId])

  function updateSlot(role: string, slotIndex: number, update: Partial<SlotState>) {
    setSlots(prev =>
      prev.map(s => s.role === role && s.slotIndex === slotIndex ? { ...s, ...update } : s)
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeSlot || !e.target.files?.[0]) return
    const file = e.target.files[0]
    const { role, index } = activeSlot

    updateSlot(role, index, { status: 'uploading', fileName: file.name })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('role', role)
    formData.append('slot_index', String(index))

    const res = await fetch(`/api/orders/${orderId}/photos`, { method: 'POST', body: formData })

    if (res.ok) {
      updateSlot(role, index, { status: 'done' })
    } else {
      updateSlot(role, index, { status: 'error' })
    }
  }

  function openFilePicker(role: string, index: number) {
    setActiveSlot({ role, index })
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  const allDone = slots.length > 0 && slots.every(s => s.status === 'done')
  const doneCount = slots.filter(s => s.status === 'done').length

  function handleFinish() {
    setSubmitting(true)
    router.push(`/orders/${orderId}/preview`)
  }

  if (slots.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload your photos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {doneCount} of {slots.length} photos uploaded
        </p>
        <Progress value={slots.length > 0 ? (doneCount / slots.length) * 100 : 0} className="mt-3" />
      </div>

      <div className="space-y-3">
        {slots.map(slot => (
          <div
            key={`${slot.role}-${slot.slotIndex}`}
            className="border rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div>
              <div className="font-medium text-sm">{slot.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{slot.description}</div>
              {slot.fileName && slot.status === 'done' && (
                <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{slot.fileName}</div>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              <Badge
                variant={slot.status === 'done' ? 'default' : slot.status === 'error' ? 'destructive' : 'outline'}
              >
                {slot.status === 'empty' ? 'Needed' :
                 slot.status === 'uploading' ? 'Uploading…' :
                 slot.status === 'done' ? 'Done' : 'Error'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openFilePicker(slot.role, slot.slotIndex)}
                disabled={slot.status === 'uploading'}
              >
                {slot.status === 'done' ? 'Replace' : 'Upload'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={handleFinish}
        disabled={!allDone || submitting}
        className="w-full"
      >
        {submitting ? 'Processing…' : 'Generate my deck'}
      </Button>
    </div>
  )
}
