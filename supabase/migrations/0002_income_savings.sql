-- Masari 0002 — income sources + savings (the "Monthly income" and "Monthly savings" sheets)
-- Run in Supabase → SQL Editor → New query → Run.

create table public.income_sources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  amount     bigint not null check (amount >= 0),   -- minor units
  currency   char(3) not null,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index income_sources_user_idx on public.income_sources (user_id);

create table public.savings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  month      date not null check (month = date_trunc('month', month)::date),
  amount     bigint not null,                        -- minor units, home currency; manual override of income - spent
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.income_sources enable row level security;
alter table public.savings        enable row level security;

create policy "own income_sources" on public.income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own savings" on public.savings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
