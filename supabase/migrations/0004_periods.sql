-- Masari 0004 — pay-cycle periods
-- A period runs from one "Close month" press to the next. Exactly one is open per user.
-- Closing freezes a snapshot (income, spent, saved, by category, top merchants, balances).
-- Budgets become per-period. Run in Supabase → SQL Editor → New query → Run.

create table public.periods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  started_at     timestamptz not null,
  closed_at      timestamptz,
  snapshot       jsonb,                 -- frozen summary, written at close
  saved_override bigint,                -- manual "what I actually saved" (minor units, home currency)
  note           text,
  created_at     timestamptz not null default now()
);
create index periods_user_started_idx on public.periods (user_id, started_at desc);
create unique index periods_one_open_per_user on public.periods (user_id) where closed_at is null;

alter table public.periods enable row level security;
create policy "own periods" on public.periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Budgets: attach to a period. Legacy calendar-month rows keep working.
alter table public.budgets add column if not exists period_id uuid references public.periods(id) on delete cascade;
alter table public.budgets drop constraint if exists budgets_month_check;
alter table public.budgets drop constraint if exists budgets_user_id_category_id_month_key;
alter table public.budgets alter column month drop not null;
create unique index if not exists budgets_period_cat_uidx
  on public.budgets (user_id, period_id, category_id) nulls not distinct
  where period_id is not null;
create unique index if not exists budgets_month_cat_uidx
  on public.budgets (user_id, month, category_id) nulls not distinct
  where period_id is null;
create index if not exists budgets_period_idx on public.budgets (period_id);
