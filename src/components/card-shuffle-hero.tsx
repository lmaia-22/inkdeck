'use client'

import { Button } from '@/components/ui/button'

const CARDS = [
  { left: 551, top: 397, rz: '-75deg', delay: '0s',    img: '1.png' },
  { left: 538, top: 360, rz: '-65deg', delay: '0.28s', img: '2.png' },
  { left: 518, top: 322, rz: '-55deg', delay: '0.56s', img: '3.png' },
  { left: 491, top: 291, rz: '-45deg', delay: '0.84s', img: '4.png' },
  { left: 459, top: 263, rz: '-35deg', delay: '1.12s', img: '5.png' },
  { left: 423, top: 242, rz: '-25deg', delay: '1.40s', img: '6.png' },
  { left: 383, top: 228, rz: '-15deg', delay: '1.68s', img: '7.png' },
  { left: 342, top: 222, rz:  '-5deg', delay: '1.96s', img: '8.png' },
  { left: 300, top: 222, rz:   '5deg', delay: '2.24s', img: '1.png' },
  { left: 258, top: 228, rz:  '15deg', delay: '2.52s', img: '2.png' },
  { left: 218, top: 242, rz:  '25deg', delay: '2.80s', img: '3.png' },
  { left: 183, top: 263, rz:  '35deg', delay: '3.08s', img: '4.png' },
  { left: 150, top: 291, rz:  '45deg', delay: '3.36s', img: '5.png' },
  { left: 122, top: 322, rz:  '55deg', delay: '3.64s', img: '6.png' },
  { left: 103, top: 360, rz:  '65deg', delay: '3.92s', img: '7.png' },
  { left:  88, top: 397, rz:  '75deg', delay: '4.20s', img: '8.png' },
]

export function CardShuffleHero({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <section
      className="relative flex items-center justify-center w-full"
      style={{ height: 560, overflow: 'visible' }}
    >
      {/* Perspective scene — cards positioned absolutely within */}
      <div
        className="relative"
        style={{ width: 640, height: 500, perspective: '900px' }}
      >
        {CARDS.map((card, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: card.left,
              top: card.top,
              animationName: 'card-toss-y',
              animationDuration: '5.6s',
              animationDelay: card.delay,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationFillMode: 'both',
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              style={{
                width: 64,
                height: 90,
                backgroundImage: `url(/${card.img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                ['--rz' as string]: card.rz,
                animationName: 'card-toss-rz',
                animationDuration: '5.6s',
                animationDelay: card.delay,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationFillMode: 'both',
              } as React.CSSProperties}
            />
          </div>
        ))}

        {/* Frosted glass text panel centered over the arc */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 10, pointerEvents: 'none' }}
        >
          <div
            className="text-center px-12 py-10 rounded-2xl"
            style={{
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              background: 'rgba(250,250,248,0.80)',
              maxWidth: 380,
              pointerEvents: 'auto',
            }}
          >
            <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
              Your photos.<br />
              As a deck of cards.
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xs mx-auto">
              Upload your photos, we turn them into ink doodles, and print them as a real playing card deck.
            </p>
            <div className="flex gap-3 justify-center">
              <a href="/signup">
                <Button size="lg" className="px-8">Get started</Button>
              </a>
              <Button size="lg" variant="outline" onClick={onSignIn} className="px-8">
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
