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
