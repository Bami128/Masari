-- Masari 0003 — account balances
-- Each account gets a "balance as of" anchor. Balance = opening_balance
-- + income logged after the anchor − expenses logged after the anchor.
-- Run in Supabase → SQL Editor → New query → Run.

alter table public.accounts
  add column if not exists opening_balance    bigint      not null default 0,
  add column if not exists opening_balance_at timestamptz not null default now(),
  add column if not exists is_default         boolean     not null default false;

-- Make the oldest account the default where none is set
update public.accounts a
set is_default = true
where not exists (select 1 from public.accounts b where b.user_id = a.user_id and b.is_default)
  and a.id = (select id from public.accounts c where c.user_id = a.user_id order by created_at limit 1);
