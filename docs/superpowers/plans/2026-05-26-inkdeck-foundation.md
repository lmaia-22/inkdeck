# InkDeck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full InkDeck app — custom photo-to-doodle playing card decks, AI-processed via Replicate, composited with Sharp, and submitted to MakePlayingCards for print fulfillment.

**Architecture:** Next.js App Router handles both the web UI and all API routes. Supabase provides auth, Postgres DB, and file storage. The card generation engine (Sharp + SVG) and Replicate AI calls run inside API routes — no background job service. Replicate uses webhooks to notify completion asynchronously.

**Tech Stack:** Next.js 15 · TypeScript · TailwindCSS · shadcn/ui · Supabase (Auth + Postgres + Storage) · Replicate API · Sharp · Vitest

---

## File Map

```
src/
  types/
    deck.ts            — Suit, Rank, DeckSize, Card
    packs.ts           — PackType, PhotoRole, PhotoRequirement, PackConfig
    database.ts        — Order, OrderPhoto, OrderCard, OrderStatus, ProcessingStatus
  config/
    deck.ts            — DECK_40, DECK_54, getDeck()
    packs.ts           — PACK_CONFIGS, getPackConfig(), getTotalPhotoCount()
    mpc-spec.ts        — MPC_SPEC (canvas dimensions, bleed, DPI)
  lib/
    supabase/
      client.ts        — browser Supabase client
      server.ts        — server/route Supabase client
    replicate/
      client.ts        — Replicate SDK singleton
      process-photo.ts — submit photo to Replicate, return prediction id
    card-gen/
      get-photo-for-card.ts   — pure: Card + PackType + photos → OrderPhoto | null
      generate-svg-overlay.ts — pure: Card + options → SVG string
      compose-card.ts         — Sharp pipeline: photo → composited 825×1125 PNG buffer
      deck-builder.ts         — orchestrates all cards for an order, writes order_cards
    mpc/
      client.ts        — MPC API stub
      submit-order.ts  — package order_cards and submit to MPC
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
    (dashboard)/
      page.tsx         — order list
    orders/
      [id]/
        configure/page.tsx
        upload/page.tsx
        preview/page.tsx
    api/
      orders/
        route.ts                    — POST: create order
      orders/[id]/
        photos/route.ts             — POST: upload photo + trigger AI
        generate/route.ts           — POST: manually trigger deck-builder
      webhooks/
        replicate/route.ts          — POST: AI done → run deck-builder
  middleware.ts        — Supabase session refresh
supabase/
  migrations/
    20260526000001_initial_schema.sql
.env.example
vitest.config.ts
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold the Next.js app in the existing directory**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --yes
```

Expected output: Next.js project files created. Existing `README.md`, `.gitignore`, and `docs/` are preserved.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr sharp replicate
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

Add core components used across the app:

```bash
npx shadcn@latest add button input label card badge separator progress
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Add test script to `package.json`**

Add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the scaffold compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with shadcn/ui and Vitest"
```

---

## Task 2: TypeScript Type Definitions

**Files:**
- Create: `src/types/deck.ts`
- Create: `src/types/packs.ts`
- Create: `src/types/database.ts`

- [ ] **Step 1: Create `src/types/deck.ts`**

```typescript
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type JokerSuit = 'joker'
export type AnySuit = Suit | JokerSuit

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type JokerRank = 'JOKER'
export type AnyRank = Rank | JokerRank

export type DeckSize = 40 | 54

export interface Card {
  suit: AnySuit
  rank: AnyRank
  jokerIndex?: 0 | 1
}
```

- [ ] **Step 2: Create `src/types/packs.ts`**

```typescript
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
```

- [ ] **Step 3: Create `src/types/database.ts`**

```typescript
import type { PackType, PhotoRole } from './packs'
import type { AnySuit, AnyRank, DeckSize } from './deck'

export type OrderStatus =
  | 'draft'
  | 'processing'
  | 'preview'
  | 'paid'
  | 'submitted'
  | 'fulfilled'

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Order {
  id: string
  user_id: string
  pack_type: PackType
  deck_size: DeckSize
  status: OrderStatus
  stripe_payment_intent_id: string | null
  mpc_order_id: string | null
  created_at: string
}

export interface OrderPhoto {
  id: string
  order_id: string
  role: PhotoRole
  slot_index: number
  original_path: string
  processed_path: string | null
  replicate_prediction_id: string | null
  processing_status: ProcessingStatus
}

export interface OrderCard {
  id: string
  order_id: string
  suit: AnySuit
  rank: AnyRank
  front_image_path: string
  back_image_path: string
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for deck, packs, and database"
```

---

## Task 3: Config Files

**Files:**
- Create: `src/config/deck.ts`
- Create: `src/config/packs.ts`
- Create: `src/config/mpc-spec.ts`
- Create: `src/__tests__/config/deck.test.ts`
- Create: `src/__tests__/config/packs.test.ts`

- [ ] **Step 1: Write failing tests for `config/deck.ts`**

Create `src/__tests__/config/deck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DECK_40, DECK_54, getDeck, SUITS, RANKS_40, RANKS_54 } from '@/config/deck'

describe('DECK_40', () => {
  it('has exactly 40 cards', () => {
    expect(DECK_40).toHaveLength(40)
  })

  it('contains no 8, 9, or 10', () => {
    const ranks = DECK_40.map(c => c.rank)
    expect(ranks).not.toContain('8')
    expect(ranks).not.toContain('9')
    expect(ranks).not.toContain('10')
  })

  it('contains A, 2-7, J, Q, K for each suit', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS_40) {
        expect(DECK_40).toContainEqual({ suit, rank })
      }
    }
  })

  it('has no jokers', () => {
    expect(DECK_40.filter(c => c.rank === 'JOKER')).toHaveLength(0)
  })
})

describe('DECK_54', () => {
  it('has exactly 54 cards', () => {
    expect(DECK_54).toHaveLength(54)
  })

  it('contains 2 jokers with jokerIndex 0 and 1', () => {
    const jokers = DECK_54.filter(c => c.rank === 'JOKER')
    expect(jokers).toHaveLength(2)
    expect(jokers[0].jokerIndex).toBe(0)
    expect(jokers[1].jokerIndex).toBe(1)
  })

  it('contains all 13 ranks for each suit', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS_54) {
        expect(DECK_54).toContainEqual({ suit, rank })
      }
    }
  })
})

describe('getDeck', () => {
  it('returns DECK_40 for size 40', () => {
    expect(getDeck(40)).toBe(DECK_40)
  })

  it('returns DECK_54 for size 54', () => {
    expect(getDeck(54)).toBe(DECK_54)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/__tests__/config/deck.test.ts
```

Expected: FAIL — `Cannot find module '@/config/deck'`

- [ ] **Step 3: Create `src/config/deck.ts`**

```typescript
import type { Card, Suit, DeckSize } from '@/types/deck'

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export const RANKS_40 = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'] as const
export const RANKS_54 = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export const DECK_40: Card[] = SUITS.flatMap(suit =>
  RANKS_40.map(rank => ({ suit, rank }))
)

export const DECK_54: Card[] = [
  ...SUITS.flatMap(suit => RANKS_54.map(rank => ({ suit, rank }))),
  { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
  { suit: 'joker', rank: 'JOKER', jokerIndex: 1 },
]

export function getDeck(size: DeckSize): Card[] {
  return size === 40 ? DECK_40 : DECK_54
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/__tests__/config/deck.test.ts
```

Expected: PASS (4 suites, all green)

- [ ] **Step 5: Write failing tests for `config/packs.ts`**

Create `src/__tests__/config/packs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getPackConfig, getTotalPhotoCount, PACK_CONFIGS } from '@/config/packs'

describe('getPackConfig', () => {
  it('simple_40 requires 1 photo (back only)', () => {
    const config = getPackConfig('simple', 40)
    expect(config.requirements).toHaveLength(1)
    expect(config.requirements[0].role).toBe('back')
    expect(config.requirements[0].count).toBe(1)
  })

  it('duo_40 requires 2 photos (back + front)', () => {
    const config = getPackConfig('duo', 40)
    expect(getTotalPhotoCount('duo', 40)).toBe(2)
    expect(config.requirements.map(r => r.role)).toEqual(['back', 'front'])
  })

  it('signature_40 requires 18 photos total', () => {
    expect(getTotalPhotoCount('signature', 40)).toBe(18)
  })

  it('signature_54 requires 20 photos total', () => {
    expect(getTotalPhotoCount('signature', 54)).toBe(20)
  })

  it('full_custom_40 requires 41 photos total', () => {
    expect(getTotalPhotoCount('full_custom', 40)).toBe(41)
  })

  it('full_custom_54 requires 55 photos total', () => {
    expect(getTotalPhotoCount('full_custom', 54)).toBe(55)
  })

  it('full_custom_40 has 24 numbered card slots', () => {
    const config = getPackConfig('full_custom', 40)
    const front = config.requirements.find(r => r.role === 'front')!
    expect(front.count).toBe(24)
  })

  it('full_custom_54 has 36 numbered card slots', () => {
    const config = getPackConfig('full_custom', 54)
    const front = config.requirements.find(r => r.role === 'front')!
    expect(front.count).toBe(36)
  })
})

describe('PACK_CONFIGS completeness', () => {
  it('covers all 8 pack+size combinations', () => {
    const keys = Object.keys(PACK_CONFIGS)
    expect(keys).toHaveLength(8)
  })
})
```

- [ ] **Step 6: Run test — verify it fails**

```bash
npx vitest run src/__tests__/config/packs.test.ts
```

Expected: FAIL — `Cannot find module '@/config/packs'`

- [ ] **Step 7: Create `src/config/packs.ts`**

```typescript
import type { PackType, PackConfig } from '@/types/packs'
import type { DeckSize } from '@/types/deck'

export const PACK_CONFIGS: Record<`${PackType}_${DeckSize}`, PackConfig> = {
  simple_40: {
    packType: 'simple',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
    ],
  },
  simple_54: {
    packType: 'simple',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
    ],
  },
  duo_40: {
    packType: 'duo',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Card Front', description: 'Photo for all card fronts' },
    ],
  },
  duo_54: {
    packType: 'duo',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Card Front', description: 'Photo for all card fronts' },
    ],
  },
  signature_40: {
    packType: 'signature',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Numbered Cards', description: 'Photo for numbered cards (2–7)' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A (4 suits each). Slot order: J♠=0, J♥=1, J♦=2, J♣=3, Q♠=4 … A♣=15' },
    ],
  },
  signature_54: {
    packType: 'signature',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 1, label: 'Numbered Cards', description: 'Photo for numbered cards (2–10)' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A (4 suits each). Slot order: J♠=0 … A♣=15' },
      { role: 'joker', count: 2, label: 'Jokers', description: '2 unique photos for the joker cards' },
    ],
  },
  full_custom_40: {
    packType: 'full_custom',
    deckSize: 40,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 24, label: 'Numbered Cards', description: '24 unique photos for 2–7 (4 suits each). Slot: rank_index×4 + suit_index' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A. Slot: rank_index×4 + suit_index' },
    ],
  },
  full_custom_54: {
    packType: 'full_custom',
    deckSize: 54,
    requirements: [
      { role: 'back', count: 1, label: 'Card Back', description: 'Photo for all card backs' },
      { role: 'front', count: 36, label: 'Numbered Cards', description: '36 unique photos for 2–10 (4 suits each). Slot: rank_index×4 + suit_index' },
      { role: 'face_ace', count: 16, label: 'Face & Ace Cards', description: '16 unique photos for J, Q, K, A. Slot: rank_index×4 + suit_index' },
      { role: 'joker', count: 2, label: 'Jokers', description: '2 unique photos for the joker cards' },
    ],
  },
}

export function getPackConfig(packType: PackType, deckSize: DeckSize): PackConfig {
  return PACK_CONFIGS[`${packType}_${deckSize}`]
}

export function getTotalPhotoCount(packType: PackType, deckSize: DeckSize): number {
  return getPackConfig(packType, deckSize).requirements.reduce((sum, r) => sum + r.count, 0)
}
```

- [ ] **Step 8: Create `src/config/mpc-spec.ts`**

```typescript
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
```

- [ ] **Step 9: Run all config tests**

```bash
npx vitest run src/__tests__/config/
```

Expected: all PASS

- [ ] **Step 10: Commit**

```bash
git add src/config/ src/__tests__/config/ vitest.config.ts
git commit -m "feat: add deck config, pack configs, and MPC spec with tests"
```

---

## Task 4: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `.env.example`
- Modify: `.env.local` (manually, not committed)

- [ ] **Step 1: Create `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REPLICATE_API_TOKEN=your-replicate-token
REPLICATE_WEBHOOK_SECRET=your-webhook-secret
```

- [ ] **Step 2: Create `.env.local` with real values**

Copy `.env.example` to `.env.local` and fill in your Supabase project URL, anon key, and service role key from the Supabase dashboard (Settings → API).

- [ ] **Step 3: Create `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Create `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Service client bypasses RLS — no session cookies needed, not async.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Create `src/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts .env.example
git commit -m "feat: add Supabase browser/server clients and auth middleware"
```

---

## Task 5: Database Migration

**Files:**
- Create: `supabase/migrations/20260526000001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260526000001_initial_schema.sql`:

```sql
-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_type text not null check (pack_type in ('simple', 'duo', 'signature', 'full_custom')),
  deck_size smallint not null check (deck_size in (40, 54)),
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'preview', 'paid', 'submitted', 'fulfilled')),
  stripe_payment_intent_id text,
  mpc_order_id text,
  created_at timestamptz not null default now()
);

-- order_photos
create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  role text not null check (role in ('back', 'front', 'face_ace', 'joker')),
  slot_index smallint not null default 0,
  original_path text not null,
  processed_path text,
  replicate_prediction_id text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'done', 'failed')),
  unique (order_id, role, slot_index)
);

-- order_cards
create table public.order_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  suit text not null,
  rank text not null,
  front_image_path text not null,
  back_image_path text not null,
  unique (order_id, suit, rank)
);

-- Row Level Security
alter table public.orders enable row level security;
alter table public.order_photos enable row level security;
alter table public.order_cards enable row level security;

create policy "users_manage_own_orders"
  on public.orders for all
  using (auth.uid() = user_id);

create policy "users_manage_own_order_photos"
  on public.order_photos for all
  using (
    exists (
      select 1 from public.orders
      where id = order_id and user_id = auth.uid()
    )
  );

create policy "users_manage_own_order_cards"
  on public.order_cards for all
  using (
    exists (
      select 1 from public.orders
      where id = order_id and user_id = auth.uid()
    )
  );

-- Storage buckets (run in Supabase dashboard Storage tab or via CLI)
-- Bucket: order-photos (private)
-- Bucket: order-cards (private)
```

- [ ] **Step 2: Apply the migration**

If using Supabase CLI:

```bash
npx supabase db push
```

If applying manually: open the Supabase dashboard → SQL Editor → paste and run the migration file.

- [ ] **Step 3: Create Storage buckets**

In the Supabase dashboard → Storage:
- Create bucket `order-photos` (private)
- Create bucket `order-cards` (private)

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database migration and RLS policies"
```

---

## Task 6: `getPhotoForCard` Pure Function

**Files:**
- Create: `src/lib/card-gen/get-photo-for-card.ts`
- Create: `src/__tests__/card-gen/get-photo-for-card.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/card-gen/get-photo-for-card.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getPhotoForCard } from '@/lib/card-gen/get-photo-for-card'
import type { OrderPhoto } from '@/types/database'

function makePhoto(overrides: Partial<OrderPhoto>): OrderPhoto {
  return {
    id: 'photo-id',
    order_id: 'order-id',
    role: 'back',
    slot_index: 0,
    original_path: 'original/path.jpg',
    processed_path: 'processed/path.jpg',
    replicate_prediction_id: null,
    processing_status: 'done',
    ...overrides,
  }
}

const backPhoto = makePhoto({ role: 'back', slot_index: 0 })
const frontPhoto = makePhoto({ role: 'front', slot_index: 0 })

describe('simple pack', () => {
  it('returns back photo for back face', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: 'A' },
      'simple', 40,
      [backPhoto],
      'back'
    )
    expect(result).toEqual(backPhoto)
  })

  it('returns null for all front faces (standard template)', () => {
    const result = getPhotoForCard(
      { suit: 'hearts', rank: 'Q' },
      'simple', 40,
      [backPhoto],
      'front'
    )
    expect(result).toBeNull()
  })
})

describe('duo pack', () => {
  it('returns front photo for any front card', () => {
    const result = getPhotoForCard(
      { suit: 'diamonds', rank: 'K' },
      'duo', 40,
      [backPhoto, frontPhoto],
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })

  it('returns back photo for back face', () => {
    const result = getPhotoForCard(
      { suit: 'clubs', rank: '7' },
      'duo', 40,
      [backPhoto, frontPhoto],
      'back'
    )
    expect(result).toEqual(backPhoto)
  })

  it('returns front photo for joker in 54-card deck', () => {
    const result = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
      'duo', 54,
      [backPhoto, frontPhoto],
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })
})

describe('signature pack', () => {
  const frontPhoto = makePhoto({ role: 'front', slot_index: 0 })
  const jspadesPhoto = makePhoto({ role: 'face_ace', slot_index: 0 }) // J♠
  const qheartsPhoto = makePhoto({ role: 'face_ace', slot_index: 5 }) // Q♥ = 1*4+1
  const aclubsPhoto = makePhoto({ role: 'face_ace', slot_index: 15 }) // A♣ = 3*4+3

  const photos = [backPhoto, frontPhoto, jspadesPhoto, qheartsPhoto, aclubsPhoto]

  it('returns front photo for numbered card', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: '5' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(frontPhoto)
  })

  it('returns slot-0 face_ace photo for J♠', () => {
    const result = getPhotoForCard(
      { suit: 'spades', rank: 'J' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(jspadesPhoto)
  })

  it('returns slot-5 face_ace photo for Q♥', () => {
    const result = getPhotoForCard(
      { suit: 'hearts', rank: 'Q' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(qheartsPhoto)
  })

  it('returns slot-15 face_ace photo for A♣', () => {
    const result = getPhotoForCard(
      { suit: 'clubs', rank: 'A' },
      'signature', 40,
      photos,
      'front'
    )
    expect(result).toEqual(aclubsPhoto)
  })

  it('returns joker photo by jokerIndex for 54-card deck', () => {
    const joker0 = makePhoto({ role: 'joker', slot_index: 0 })
    const joker1 = makePhoto({ role: 'joker', slot_index: 1 })
    const result0 = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 0 },
      'signature', 54,
      [...photos, joker0, joker1],
      'front'
    )
    const result1 = getPhotoForCard(
      { suit: 'joker', rank: 'JOKER', jokerIndex: 1 },
      'signature', 54,
      [...photos, joker0, joker1],
      'front'
    )
    expect(result0).toEqual(joker0)
    expect(result1).toEqual(joker1)
  })
})

describe('full_custom pack', () => {
  it('returns unique photo for each numbered card in 40-card deck', () => {
    // 2♠ = slot 0, 2♥ = slot 1
    const twoSpades = makePhoto({ role: 'front', slot_index: 0 })
    const twoHearts = makePhoto({ role: 'front', slot_index: 1 })
    const photos = [backPhoto, twoSpades, twoHearts]

    expect(
      getPhotoForCard({ suit: 'spades', rank: '2' }, 'full_custom', 40, photos, 'front')
    ).toEqual(twoSpades)

    expect(
      getPhotoForCard({ suit: 'hearts', rank: '2' }, 'full_custom', 40, photos, 'front')
    ).toEqual(twoHearts)
  })

  it('returns unique photo for each numbered card in 54-card deck', () => {
    // 10♣ = slot 8*4+3 = 35
    const tenClubs = makePhoto({ role: 'front', slot_index: 35 })
    const photos = [backPhoto, tenClubs]

    expect(
      getPhotoForCard({ suit: 'clubs', rank: '10' }, 'full_custom', 54, photos, 'front')
    ).toEqual(tenClubs)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/__tests__/card-gen/get-photo-for-card.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/card-gen/get-photo-for-card'`

- [ ] **Step 3: Create `src/lib/card-gen/get-photo-for-card.ts`**

```typescript
import type { Card } from '@/types/deck'
import type { PackType } from '@/types/packs'
import type { OrderPhoto } from '@/types/database'
import type { PhotoRole } from '@/types/packs'

const SUIT_INDEX: Record<string, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
}

const FACE_ACE_RANK_INDEX: Record<string, number> = {
  J: 0,
  Q: 1,
  K: 2,
  A: 3,
}

const NUMBERED_40_RANK_INDEX: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5,
}

const NUMBERED_54_RANK_INDEX: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4,
  '7': 5, '8': 6, '9': 7, '10': 8,
}

function find(photos: OrderPhoto[], role: PhotoRole, slotIndex = 0): OrderPhoto | null {
  return photos.find(p => p.role === role && p.slot_index === slotIndex) ?? null
}

function faceAceSlot(card: Card): number {
  return FACE_ACE_RANK_INDEX[card.rank] * 4 + SUIT_INDEX[card.suit]
}

function numberedSlot(card: Card, deckSize: 40 | 54): number {
  const index = deckSize === 40
    ? NUMBERED_40_RANK_INDEX[card.rank]
    : NUMBERED_54_RANK_INDEX[card.rank]
  return index * 4 + SUIT_INDEX[card.suit]
}

export function getPhotoForCard(
  card: Card,
  packType: PackType,
  deckSize: 40 | 54,
  photos: OrderPhoto[],
  face: 'front' | 'back'
): OrderPhoto | null {
  if (face === 'back') return find(photos, 'back', 0)

  if (card.rank === 'JOKER') {
    if (packType === 'simple') return null
    if (packType === 'duo') return find(photos, 'front', 0)
    return find(photos, 'joker', card.jokerIndex ?? 0)
  }

  if (card.rank in FACE_ACE_RANK_INDEX) {
    if (packType === 'simple') return null
    if (packType === 'duo') return find(photos, 'front', 0)
    return find(photos, 'face_ace', faceAceSlot(card))
  }

  switch (packType) {
    case 'simple': return null
    case 'duo': return find(photos, 'front', 0)
    case 'signature': return find(photos, 'front', 0)
    case 'full_custom': return find(photos, 'front', numberedSlot(card, deckSize))
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/__tests__/card-gen/get-photo-for-card.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-gen/get-photo-for-card.ts src/__tests__/card-gen/get-photo-for-card.test.ts
git commit -m "feat: add getPhotoForCard pure function with full test coverage"
```

---

## Task 7: `generateSvgOverlay`

**Files:**
- Create: `src/lib/card-gen/generate-svg-overlay.ts`
- Create: `src/__tests__/card-gen/generate-svg-overlay.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/card-gen/generate-svg-overlay.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/__tests__/card-gen/generate-svg-overlay.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/card-gen/generate-svg-overlay'`

- [ ] **Step 3: Create `src/lib/card-gen/generate-svg-overlay.ts`**

```typescript
import type { Card, Suit } from '@/types/deck'

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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/__tests__/card-gen/generate-svg-overlay.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-gen/generate-svg-overlay.ts src/__tests__/card-gen/generate-svg-overlay.test.ts
git commit -m "feat: add SVG overlay generator for card rank/suit compositing"
```

---

## Task 8: `composeCard` Sharp Pipeline

**Files:**
- Create: `src/lib/card-gen/compose-card.ts`
- Create: `src/__tests__/card-gen/compose-card.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/card-gen/compose-card.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBuffer = Buffer.from('fake-png-data')
const mockToBuffer = vi.fn().mockResolvedValue(mockBuffer)
const mockPng = vi.fn().mockReturnValue({ toBuffer: mockToBuffer })
const mockComposite = vi.fn().mockReturnValue({ png: mockPng })
const mockResize = vi.fn().mockReturnValue({ composite: mockComposite })
const mockSharpInstance = { resize: mockResize }
const mockCreate = vi.fn().mockReturnValue({ composite: mockComposite })

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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/__tests__/card-gen/compose-card.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/card-gen/compose-card'`

- [ ] **Step 3: Create `src/lib/card-gen/compose-card.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/__tests__/card-gen/compose-card.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-gen/compose-card.ts src/__tests__/card-gen/compose-card.test.ts
git commit -m "feat: add Sharp card compositing pipeline"
```

---

## Task 9: `deckBuilder` Orchestration

**Files:**
- Create: `src/lib/card-gen/deck-builder.ts`

- [ ] **Step 1: Create `src/lib/card-gen/deck-builder.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { getDeck } from '@/config/deck'
import { getPhotoForCard } from './get-photo-for-card'
import { composeCard } from './compose-card'
import type { Order, OrderPhoto } from '@/types/database'
import type { Card } from '@/types/deck'

const BATCH_SIZE = 5

async function downloadPhoto(storagePath: string): Promise<Buffer> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from('order-photos')
    .download(storagePath)

  if (error || !data) throw new Error(`Failed to download photo: ${storagePath}`)
  return Buffer.from(await data.arrayBuffer())
}

async function uploadCard(
  orderId: string,
  card: Card,
  face: 'front' | 'back',
  buffer: Buffer
): Promise<string> {
  const supabase = createServiceClient()
  const fileName = card.rank === 'JOKER'
    ? `${face}_joker_${card.jokerIndex ?? 0}.png`
    : `${face}_${card.suit}_${card.rank}.png`
  const path = `${orderId}/${fileName}`

  const { error } = await supabase.storage
    .from('order-cards')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new Error(`Failed to upload card: ${path}`)
  return path
}

async function buildCard(
  card: Card,
  order: Order,
  photos: OrderPhoto[]
): Promise<{ suit: string; rank: string; frontPath: string; backPath: string }> {
  const frontPhoto = getPhotoForCard(card, order.pack_type, order.deck_size, photos, 'front')
  const backPhoto = getPhotoForCard(card, order.pack_type, order.deck_size, photos, 'back')

  const frontBuffer = frontPhoto?.processed_path
    ? await downloadPhoto(frontPhoto.processed_path)
    : null

  const backBuffer = backPhoto?.processed_path
    ? await downloadPhoto(backPhoto.processed_path)
    : null

  const frontComposed = await composeCard(card, frontBuffer, frontBuffer !== null)
  const backComposed = await composeCard(
    { suit: 'spades', rank: 'A' },
    backBuffer,
    backBuffer !== null
  )

  const frontPath = await uploadCard(order.id, card, 'front', frontComposed)
  const backPath = await uploadCard(order.id, card, 'back', backComposed)

  return { suit: card.suit, rank: card.rank, frontPath, backPath }
}

export async function buildDeck(order: Order, photos: OrderPhoto[]): Promise<void> {
  const supabase = createServiceClient()
  const cards = getDeck(order.deck_size)

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(card => buildCard(card, order, photos))
    )

    const rows = results.map(r => ({
      order_id: order.id,
      suit: r.suit,
      rank: r.rank,
      front_image_path: r.frontPath,
      back_image_path: r.backPath,
    }))

    const { error } = await supabase
      .from('order_cards')
      .upsert(rows, { onConflict: 'order_id,suit,rank' })

    if (error) throw new Error(`Failed to save order_cards batch: ${error.message}`)
  }

  await supabase
    .from('orders')
    .update({ status: 'preview' })
    .eq('id', order.id)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/card-gen/deck-builder.ts
git commit -m "feat: add deck-builder orchestration for full order card generation"
```

---

## Task 10: Replicate Client

**Files:**
- Create: `src/lib/replicate/client.ts`
- Create: `src/lib/replicate/process-photo.ts`

- [ ] **Step 1: Create `src/lib/replicate/client.ts`**

```typescript
import Replicate from 'replicate'

let client: Replicate | null = null

export function getReplicateClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })
  }
  return client
}
```

- [ ] **Step 2: Create `src/lib/replicate/process-photo.ts`**

The model used is `jagilley/controlnet-scribble` which converts photos to line-art sketches. The webhook URL is the deployed app's `/api/webhooks/replicate` endpoint.

```typescript
import { getReplicateClient } from './client'

const LINE_ART_MODEL = 'jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117'

export async function processPhotoAsync(params: {
  imageUrl: string
  photoId: string
  webhookUrl: string
}): Promise<string> {
  const replicate = getReplicateClient()

  const prediction = await replicate.predictions.create({
    version: LINE_ART_MODEL,
    input: {
      image: params.imageUrl,
      prompt: 'minimalist ink drawing, black and white line art, clean sketch style, white background',
      image_resolution: '768',
      detect_resolution: 768,
    },
    webhook: params.webhookUrl,
    webhook_events_filter: ['completed'],
    // Pass the photo ID so the webhook knows which order_photo to update
    // Replicate allows arbitrary metadata via the `input` field — we use a custom key
  })

  if (!prediction.id) throw new Error('Replicate did not return a prediction ID')
  return prediction.id
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/replicate/
git commit -m "feat: add Replicate client and process-photo helper"
```

---

## Task 11: API Route — Create Order

**Files:**
- Create: `src/app/api/orders/route.ts`

- [ ] **Step 1: Create `src/app/api/orders/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PackType } from '@/types/packs'
import type { DeckSize } from '@/types/deck'
import { getPackConfig } from '@/config/packs'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { pack_type, deck_size } = body as { pack_type: PackType; deck_size: DeckSize }

  if (!['simple', 'duo', 'signature', 'full_custom'].includes(pack_type)) {
    return NextResponse.json({ error: 'Invalid pack_type' }, { status: 400 })
  }
  if (deck_size !== 40 && deck_size !== 54) {
    return NextResponse.json({ error: 'Invalid deck_size' }, { status: 400 })
  }

  getPackConfig(pack_type, deck_size) // throws if combo is invalid

  const { data: order, error } = await supabase
    .from('orders')
    .insert({ user_id: user.id, pack_type, deck_size, status: 'draft' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ order }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "feat: add POST /api/orders endpoint"
```

---

## Task 12: API Route — Get Order

**Files:**
- Create: `src/app/api/orders/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/orders/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select()
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ order })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/orders/
git commit -m "feat: add GET /api/orders/[id] endpoint"
```

---

## Task 13: API Route — Upload Photo + Trigger AI

**Files:**
- Create: `src/app/api/orders/[id]/photos/route.ts`

- [ ] **Step 1: Create `src/app/api/orders/[id]/photos/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processPhotoAsync } from '@/lib/replicate/process-photo'
import type { PhotoRole } from '@/types/packs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select()
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'draft') {
    return NextResponse.json({ error: 'Order is not in draft state' }, { status: 409 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const role = formData.get('role') as PhotoRole
  const slotIndex = parseInt(formData.get('slot_index') as string ?? '0', 10)

  if (!file || !role) {
    return NextResponse.json({ error: 'Missing file or role' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${orderId}/${role}_${slotIndex}.${ext}`

  const { error: uploadError } = await serviceSupabase.storage
    .from('order-photos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: photo, error: insertError } = await serviceSupabase
    .from('order_photos')
    .upsert({
      order_id: orderId,
      role,
      slot_index: slotIndex,
      original_path: storagePath,
      processing_status: 'pending',
    }, { onConflict: 'order_id,role,slot_index' })
    .select()
    .single()

  if (insertError || !photo) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = serviceSupabase.storage
    .from('order-photos')
    .getPublicUrl(storagePath)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate?photo_id=${photo.id}`

  try {
    const predictionId = await processPhotoAsync({
      imageUrl: publicUrl,
      photoId: photo.id,
      webhookUrl,
    })

    await serviceSupabase
      .from('order_photos')
      .update({ replicate_prediction_id: predictionId, processing_status: 'processing' })
      .eq('id', photo.id)
  } catch (err) {
    await serviceSupabase
      .from('order_photos')
      .update({ processing_status: 'failed' })
      .eq('id', photo.id)
    return NextResponse.json({ error: 'AI processing failed to start' }, { status: 500 })
  }

  return NextResponse.json({ photo }, { status: 201 })
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_APP_URL` to `.env.example` and `.env.local`**

```bash
# .env.example
NEXT_PUBLIC_APP_URL=https://your-inkdeck.vercel.app
```

For local dev, set `NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app` (Replicate webhooks need a public URL).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/
git commit -m "feat: add photo upload endpoint with Replicate AI trigger"
```

---

## Task 14: Replicate Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/replicate/route.ts`

- [ ] **Step 1: Create `src/app/api/webhooks/replicate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildDeck } from '@/lib/card-gen/deck-builder'
import type { Order, OrderPhoto } from '@/types/database'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const photoId = url.searchParams.get('photo_id')

  if (!photoId) {
    return NextResponse.json({ error: 'Missing photo_id' }, { status: 400 })
  }

  const body = await request.json()
  const { status, output } = body

  const supabase = createServiceClient()

  if (status === 'failed' || !output) {
    await supabase
      .from('order_photos')
      .update({ processing_status: 'failed' })
      .eq('id', photoId)
    return NextResponse.json({ ok: true })
  }

  const outputUrl: string = Array.isArray(output) ? output[0] : output

  const imageResponse = await fetch(outputUrl)
  if (!imageResponse.ok) {
    await supabase.from('order_photos').update({ processing_status: 'failed' }).eq('id', photoId)
    return NextResponse.json({ error: 'Could not fetch output image' }, { status: 500 })
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer())

  const { data: photo } = await supabase
    .from('order_photos')
    .select()
    .eq('id', photoId)
    .single<OrderPhoto>()

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  const processedPath = photo.original_path.replace(/\.[^.]+$/, '_processed.png')

  await supabase.storage
    .from('order-photos')
    .upload(processedPath, buffer, { contentType: 'image/png', upsert: true })

  await supabase
    .from('order_photos')
    .update({ processed_path: processedPath, processing_status: 'done' })
    .eq('id', photoId)

  const { data: remainingPhotos } = await supabase
    .from('order_photos')
    .select()
    .eq('order_id', photo.order_id)
    .neq('processing_status', 'done')

  if (!remainingPhotos || remainingPhotos.length === 0) {
    const { data: order } = await supabase
      .from('orders')
      .select()
      .eq('id', photo.order_id)
      .single<Order>()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const { data: allPhotos } = await supabase
      .from('order_photos')
      .select()
      .eq('order_id', photo.order_id)

    await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', order.id)

    await buildDeck(order, allPhotos as OrderPhoto[])
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat: add Replicate webhook handler that triggers deck-builder on completion"
```

---

## Task 15: MPC Client Stub

**Files:**
- Create: `src/lib/mpc/client.ts`
- Create: `src/lib/mpc/submit-order.ts`

- [ ] **Step 1: Create `src/lib/mpc/client.ts`**

```typescript
export interface MpcClientConfig {
  apiKey: string
  baseUrl: string
}

export function getMpcConfig(): MpcClientConfig {
  return {
    apiKey: process.env.MPC_API_KEY ?? '',
    baseUrl: process.env.MPC_BASE_URL ?? 'https://api.makeplayingcards.com',
  }
}
```

- [ ] **Step 2: Create `src/lib/mpc/submit-order.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { getMpcConfig } from './client'
import type { Order, OrderCard } from '@/types/database'

export async function submitOrderToMpc(order: Order): Promise<string> {
  const supabase = createServiceClient()
  const { apiKey, baseUrl } = getMpcConfig()

  const { data: cards } = await supabase
    .from('order_cards')
    .select()
    .eq('order_id', order.id)

  if (!cards || cards.length === 0) {
    throw new Error('No order_cards found for order')
  }

  // TODO: Replace with real MPC API integration once MPC API credentials are available.
  // MPC API docs: https://www.makeplayingcards.com/design/xtreme-uni-custom-deck.html
  // For now: log the submission and return a stub order ID.
  console.log(`[MPC STUB] Submitting order ${order.id} with ${cards.length} cards`)
  console.log(`[MPC STUB] Pack: ${order.pack_type}, Size: ${order.deck_size}`)

  const stubMpcOrderId = `MPC-STUB-${order.id.slice(0, 8).toUpperCase()}`

  await supabase
    .from('orders')
    .update({ status: 'submitted', mpc_order_id: stubMpcOrderId })
    .eq('id', order.id)

  return stubMpcOrderId
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mpc/
git commit -m "feat: add MPC client stub for order submission"
```

---

## Task 16: Auth Pages

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
      <div className="w-full max-w-sm px-4">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
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

    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">InkDeck</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
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
      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/signup" className="underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(auth)/signup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">InkDeck</h1>
        <p className="text-sm text-muted-foreground mt-1">Create an account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login and signup auth pages"
```

---

## Task 17: Dashboard — Order List

**Files:**
- Create: `src/app/(dashboard)/page.tsx`
- Create: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `src/app/(dashboard)/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">InkDeck</span>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/page.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Order } from '@/types/database'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  processing: 'Processing…',
  preview: 'Ready to Review',
  paid: 'Paid',
  submitted: 'Sent to Print',
  fulfilled: 'Fulfilled',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  processing: 'secondary',
  preview: 'default',
  paid: 'default',
  submitted: 'secondary',
  fulfilled: 'secondary',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Decks</h1>
        <Link href="/orders/new/configure">
          <Button>New Deck</Button>
        </Link>
      </div>

      {!orders?.length && (
        <p className="text-muted-foreground text-sm">
          No decks yet. Create your first one!
        </p>
      )}

      <div className="space-y-3">
        {orders?.map((order: Order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}/${order.status === 'draft' ? 'configure' : order.status === 'preview' ? 'preview' : 'configure'}`}
            className="block"
          >
            <div className="border rounded-lg px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
              <div>
                <span className="font-medium capitalize">{order.pack_type.replace('_', ' ')}</span>
                <span className="text-muted-foreground text-sm ml-2">{order.deck_size} cards</span>
              </div>
              <Badge variant={STATUS_VARIANT[order.status]}>
                {STATUS_LABEL[order.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat: add dashboard with order list"
```

---

## Task 18: Configure Page

**Files:**
- Create: `src/app/orders/[id]/configure/page.tsx`

- [ ] **Step 1: Create `src/app/orders/[id]/configure/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/orders/
git commit -m "feat: add configure page for pack and deck size selection"
```

---

## Task 19: Upload Page

**Files:**
- Create: `src/app/orders/[id]/upload/page.tsx`

- [ ] **Step 1: Create `src/app/orders/[id]/upload/page.tsx`**

```tsx
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
  const [order, setOrder] = useState<Order | null>(null)
  const [slots, setSlots] = useState<SlotState[]>([])

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(({ order }: { order: Order }) => {
        setOrder(order)
        const config = getPackConfig(order.pack_type, order.deck_size)
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

  const initialSlots: SlotState[] = config.requirements.flatMap(req =>
    Array.from({ length: req.count }, (_, i) => ({
      role: req.role,
      slotIndex: i,
      label: req.count === 1 ? req.label : `${req.label} #${i + 1}`,
      description: req.description,
      status: 'empty' as const,
    }))
  )

  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeSlot, setActiveSlot] = useState<{ role: string; index: number } | null>(null)

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
    fileInputRef.current?.click()
  }

  const allDone = slots.every(s => s.status === 'done')
  const doneCount = slots.filter(s => s.status === 'done').length

  async function handleFinish() {
    setSubmitting(true)
    router.push(`/orders/${orderId}/preview`)
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload your photos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {doneCount} of {slots.length} photos uploaded
        </p>
        <Progress value={(doneCount / slots.length) * 100} className="mt-3" />
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/orders/
git commit -m "feat: add photo upload page with per-slot progress tracking"
```

---

## Task 20: Preview Page

**Files:**
- Create: `src/app/orders/[id]/preview/page.tsx`

- [ ] **Step 1: Create `src/app/orders/[id]/preview/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Order, OrderCard } from '@/types/database'

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select()
    .eq('id', id)
    .single<Order>()

  if (!order) redirect('/')

  if (order.status === 'processing' || order.status === 'draft') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">Generating your deck…</div>
          <p className="text-sm text-muted-foreground">
            This usually takes 1–3 minutes. Refresh the page to check progress.
          </p>
          <Badge variant="secondary">{order.status}</Badge>
        </div>
      </div>
    )
  }

  const { data: cards } = await supabase
    .from('order_cards')
    .select()
    .eq('order_id', id)
    .order('suit')
    .order('rank')

  const { data: { publicUrl: baseUrl } } = supabase.storage
    .from('order-cards')
    .getPublicUrl('')

  return (
    <div className="min-h-screen bg-[#FAFAF8] max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your deck preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cards?.length} cards · {order.pack_type.replace('_', ' ')} · {order.deck_size}-card deck
          </p>
        </div>
        <Badge>{order.status}</Badge>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {cards?.map((card: OrderCard) => {
          const cardKey = card.rank === 'JOKER'
            ? `joker-${card.id}`
            : `${card.suit}-${card.rank}`
          return (
            <div key={cardKey} className="aspect-[5.5/8.5] rounded overflow-hidden border bg-white">
              {card.front_image_path ? (
                <img
                  src={`${baseUrl}/${card.front_image_path}`}
                  alt={`${card.rank} of ${card.suit}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  {card.rank} {card.suit.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {order.status === 'preview' && (
        <div className="pt-4">
          <Button className="w-full" size="lg" disabled>
            Proceed to checkout (Stripe coming soon)
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/orders/
git commit -m "feat: add preview page showing all generated card images"
```

---

## Task 21: Final Wiring + Smoke Test

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify routing**

```bash
npm run dev
```

Open http://localhost:3000 — should redirect to `/login`.

Sign up, then navigate to `/orders/new/configure` — should show the pack selection UI.

- [ ] **Step 4: Add `.superpowers/` to `.gitignore`**

Add to `.gitignore`:
```
.superpowers/
```

- [ ] **Step 5: Final commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers/ brainstorm artifacts"
```

---

## Summary

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| Foundation | 1–5 | Scaffolded Next.js app, types, config, Supabase clients, DB schema |
| Card Engine | 6–9 | `getPhotoForCard`, SVG overlay, Sharp compositing, deck-builder — fully tested |
| AI Pipeline | 10–13 | Replicate client, photo upload API, webhook handler |
| UI | 14–19 | Auth, dashboard, configure, upload, preview pages |
| MPC | 14 | Stubbed submit-order (real MPC API wired up in a future task) |
