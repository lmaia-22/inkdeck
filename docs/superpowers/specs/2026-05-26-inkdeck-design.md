# InkDeck — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Overview

InkDeck is a Next.js web app that lets users order custom playable card decks using their own photos. Photos are converted into minimalist doodle-style line-art via an AI model (Replicate), composited onto print-ready card templates using Sharp + SVG overlays, and submitted to MakePlayingCards (MPC) for physical print fulfillment.

Every card in every deck always shows a visible rank and suit — the deck is always playable.

---

## Stack

- **Frontend / Backend:** Next.js App Router, TypeScript, TailwindCSS, shadcn/ui
- **Auth:** Supabase Auth
- **Database:** Supabase Postgres
- **Storage:** Supabase Storage
- **AI Processing:** Replicate API (photo → doodle line-art model)
- **Card Compositing:** Sharp + SVG overlays
- **Print Fulfillment:** MakePlayingCards (MPC) API
- **Payments:** Stripe (future)

---

## Pack Types

Each pack is available in two deck sizes: **40-card** and **54-card**.

### Deck Structures

| Deck | Suits | Ranks | Total |
|------|-------|-------|-------|
| 40-card | ♠ ♥ ♦ ♣ | A 2 3 4 5 6 7 J Q K | 40 |
| 54-card | ♠ ♥ ♦ ♣ | A 2 3 4 5 6 7 8 9 10 J Q K + 2×Joker | 54 |

### Photo Requirements per Pack

| Pack | Back | Front (numbered) | Face + Ace (J/Q/K/A) | Jokers | Total photos |
|------|------|-----------------|----------------------|--------|--------------|
| Simple 40 | 1 | — | — | — | 1 |
| Simple 54 | 1 | — | — | — | 1 |
| Duo 40 | 1 | 1 (all fronts) | same as front | — | 2 |
| Duo 54 | 1 | 1 (all fronts) | same as front | same as front | 2 |
| Signature 40 | 1 | 1 | 16 unique | — | 18 |
| Signature 54 | 1 | 1 | 16 unique | 2 unique | 20 |
| Full Custom 40 | 1 | 24 unique | 16 unique | — | 41 |
| Full Custom 54 | 1 | 36 unique | 16 unique | 2 unique | 55 |

**Simple pack fronts** use a standard InkDeck template (rank + suit on clean background) — no user photo on the front face.

**Numbered cards** are defined as: ranks 2–7 for 40-card, ranks 2–10 for 54-card.  
**Face + Ace** are: J, Q, K, A across all 4 suits (16 slots).  
**Jokers** are 2 slots, 54-card only.

### Slot Indexing

For roles with multiple photos, slots are indexed as follows:

- **face_ace:** `slot = rank_index * 4 + suit_index`  
  Ranks: J=0, Q=1, K=2, A=3 — Suits: ♠=0, ♥=1, ♦=2, ♣=3  
  → J♠=0, J♥=1 … A♣=15

- **numbered (Full Custom):** `slot = rank_index * 4 + suit_index`  
  Ranks for 40-card: 2=0…7=5; for 54-card: 2=0…10=8  
  → 2♠=0, 2♥=1 … 10♣=35 (54-card)

- **joker:** slot 0 = first joker, slot 1 = second joker

---

## Architecture

### System Components

```
Browser (Next.js App Router)
    ↕
Next.js API Routes
    ├── Supabase Auth
    ├── Supabase Postgres (orders, order_photos, order_cards)
    ├── Supabase Storage (original + processed photos, final card PNGs)
    ├── Replicate API  ← async, webhook-based
    └── MPC API        ← called post-payment

Sharp + SVG Card Engine  (runs inside API routes, no extra service)
```

### User Flow

1. **Auth** — sign up / log in via Supabase Auth
2. **Configure** — select pack type + deck size → creates `orders` row (status: `draft`)
3. **Upload** — user uploads photos per slot requirements; stored in Supabase Storage
4. **AI Process** — API route calls Replicate for each photo; `order.status` → `processing`
5. **Webhook** — Replicate calls `/api/webhooks/replicate` when done; processed paths saved; deck-builder generates all `order_cards`; `order.status` → `preview`
6. **Preview** — user reviews all generated cards
7. **Checkout** — Stripe payment; `order.status` → `paid`
8. **Submit to MPC** — Stripe webhook triggers MPC submission; `order.status` → `submitted`
9. **Fulfillment** — MPC confirms; `order.status` → `fulfilled`

### Order Status Machine

```
draft → processing → preview → paid → submitted → fulfilled
```

---

## Data Model

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| pack_type | text | simple \| duo \| signature \| full_custom |
| deck_size | int2 | 40 \| 54 |
| status | text | draft \| processing \| preview \| paid \| submitted \| fulfilled |
| stripe_payment_intent_id | text | nullable |
| mpc_order_id | text | nullable |
| created_at | timestamptz | default now() |

### `order_photos`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_id | uuid | FK → orders |
| role | text | back \| front \| face_ace \| joker |
| slot_index | int2 | 0-based; distinguishes multiple face_ace/numbered slots |
| original_path | text | Supabase Storage path of user upload |
| processed_path | text | Supabase Storage path after Replicate |
| replicate_prediction_id | text | for job tracking |
| processing_status | text | pending \| processing \| done \| failed |

### `order_cards`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_id | uuid | FK → orders |
| suit | text | spades \| hearts \| diamonds \| clubs \| joker |
| rank | text | A \| 2..10 \| J \| Q \| K \| JOKER |
| front_image_path | text | composited PNG 825×1125px in Storage |
| back_image_path | text | composited PNG 825×1125px in Storage |

---

## Card Generation Logic

### Photo Resolution (`get-photo-for-card.ts`)

Pure function: `getPhotoForCard(card, packType, photos) → OrderPhoto | null`

| Pack | Card type | Photo used |
|------|-----------|------------|
| simple | any front | `null` → standard template |
| simple | back | role=`back` |
| duo | any front | role=`front`, slot=0 |
| duo | back | role=`back` |
| signature | numbered | role=`front`, slot=0 |
| signature | face/ace | role=`face_ace`, slot=computed |
| signature | joker | role=`joker`, slot=0\|1 |
| signature | back | role=`back` |
| full_custom | numbered | role=`front`, slot=computed |
| full_custom | face/ace | role=`face_ace`, slot=computed |
| full_custom | joker | role=`joker`, slot=0\|1 |
| full_custom | back | role=`back` |

### Sharp + SVG Pipeline (per card)

1. Download `processed_path` from Supabase Storage
2. `sharp(buffer).resize(825, 1125, { fit: 'cover' })`
3. Generate SVG overlay: rank top-left + inverted bottom-right, suit symbol, card border (hand-drawn style matching InkDeck aesthetic)
4. `sharp.composite([{ input: svgBuffer, top: 0, left: 0 }])`
5. `.png().toBuffer()` → upload to Storage as `order_cards/{order_id}/{suit}_{rank}.png`

### MPC File Spec

- **Canvas size (with bleed):** 825 × 1125 px
- **Safe zone:** 750 × 1050 px (37.5px bleed each side)
- **Resolution:** 300 DPI
- **Format:** PNG, RGB, sRGB color space

---

## Project Structure

```
src/
  app/
    (auth)/
      login/         sign in page
      signup/        sign up page
    (dashboard)/
      orders/        order list
    orders/[id]/
      configure/     pack + size selection
      upload/        photo upload per slot
      preview/       generated card deck review
      checkout/      Stripe checkout
    api/
      orders/route.ts                     create order
      orders/[id]/photos/route.ts         upload + trigger AI
      orders/[id]/process/route.ts        manual re-trigger
      orders/[id]/generate/route.ts       trigger deck-builder
      webhooks/replicate/route.ts         AI completion webhook
      webhooks/stripe/route.ts            payment confirmation webhook

lib/
  supabase/
    client.ts          browser client
    server.ts          server/route client
    middleware.ts      session refresh
  replicate/
    client.ts          Replicate SDK wrapper
    process-photo.ts   submit photo, return prediction id
  card-gen/
    get-photo-for-card.ts   photo resolution logic (pure)
    generate-svg-overlay.ts SVG string generation
    compose-card.ts         Sharp pipeline per card
    deck-builder.ts         orchestrates all cards for an order
  mpc/
    client.ts          MPC API wrapper
    submit-order.ts    package + submit order_cards to MPC

config/
  packs.ts             PACK_CONFIGS: pack+size → slot requirements
  deck.ts              DECK_40, DECK_54: suit/rank arrays
  mpc-spec.ts          MPC_SPEC: canvas dimensions, DPI, bleed

types/
  database.ts          Supabase DB row types
  deck.ts              Card, Suit, Rank, DeckSize
  packs.ts             PackType, PhotoRole, PackConfig, PhotoRequirement
```

---

## Key Design Decisions

1. **No background job service at launch** — Replicate webhooks update order status directly via API routes. Inngest/Trigger.dev is a natural migration path if order volume justifies it.

2. **Sharp + SVG over node-canvas** — No native Cairo dependency, runs cleanly on Vercel/serverless, sufficient for rank/suit overlay compositing.

3. **`config/packs.ts` as single source of truth** — UI slot validation, upload form generation, and photo resolution logic all read from `PACK_CONFIGS`. No magic numbers elsewhere.

4. **`getPhotoForCard` is a pure function** — Deterministic, no I/O, fully testable. The card engine is split into lookup (pure) → Sharp pipeline (I/O) for clean separation.

5. **Stripe deferred** — Payment flow is stubbed in the order status machine but not implemented in phase 1. The `paid` state transition will be wired up when Stripe is added.
