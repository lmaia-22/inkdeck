'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#FAFAF8] rounded-xl border border-border shadow-lg px-8 py-8 focus:outline-none">
        <Dialog.Title className="text-xl font-bold tracking-tight mb-1">Sign in</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground mb-6">
          Welcome back to InkDeck
        </Dialog.Description>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="modal-email">Email</Label>
            <Input
              id="modal-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modal-password">Password</Label>
            <Input
              id="modal-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          No account?{' '}
          <a href="/signup" className="underline underline-offset-2">
            Sign up
          </a>
        </p>
        <Dialog.Close className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none" aria-label="Close">
          ✕
        </Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  )
}

export default function LandingPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="text-xl font-bold tracking-tight">InkDeck</span>
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto w-full gap-8 pb-24">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Your photos.<br />
            As a deck of cards.
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Upload your photos, we turn them into ink doodles, and print them as a real playing card deck.
          </p>
        </div>

        <div className="flex gap-3">
          <a href="/signup">
            <Button size="lg" className="px-8">
              Get started
            </Button>
          </a>
          <Button size="lg" variant="outline" onClick={() => setOpen(true)} className="px-8">
            Sign in
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-4 text-left w-full max-w-lg">
          {[
            { label: 'Simple', desc: '1 photo for the card back' },
            { label: 'Signature', desc: 'Unique face & ace cards' },
            { label: 'Full Custom', desc: 'Every card, your photo' },
          ].map(item => (
            <div key={item.label} className="border rounded-lg px-4 py-3 bg-white/60">
              <div className="font-semibold text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <LoginModal onClose={() => setOpen(false)} />
      </Dialog.Root>
    </div>
  )
}
