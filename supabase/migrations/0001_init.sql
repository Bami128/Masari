-- Masari v1 schema
-- Run this in Supabase → SQL Editor → New query → Run.
create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  home_currency    char(3) not null default 'QAR',
  salary_day       smallint check (salary_day between 1 and 31),
  monthly_income   bigint,
  monthly_budget   bigint,
  report_frequency text not null default 'weekly'
                   check (report_frequency in ('daily','weekly','monthly')),
  report_hour      smallint not null default 20 check (report_hour between 0 and 23),
  timezone         text not null default 'Asia/Qatar',
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- accounts ----------
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('cash','bank','card')),
  currency    char(3) not null,
  color       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);

-- ---------- categories ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  color      text,
  kind       text not null check (kind in ('expense','income')),
  sort_order int  not null default 0,
  unique (user_id, name, kind)
);
create index categories_user_idx on public.categories (user_id);

-- ---------- recurring rules (subscriptions & known bills) ----------
create table public.recurring_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  amount            bigint not null check (amount > 0),
  currency          char(3) not null,
  category_id       uuid references public.categories(id) on delete set null,
  interval          text not null check (interval in ('weekly','monthly','yearly')),
  next_due          date not null,
  merchant_pattern  text,
  is_auto_detected  boolean not null default false,
  alert_days_before smallint not null default 2,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index recurring_rules_user_idx on public.recurring_rules (user_id);

-- ---------- transactions ----------
create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  account_id        uuid references public.accounts(id) on delete set null,
  category_id       uuid references public.categories(id) on delete set null,
  type              text not null check (type in ('expense','income','transfer')),
  amount            bigint not null check (amount > 0),
  currency          char(3) not null,
  amount_home       bigint not null,
  fx_rate           numeric(18,8) not null default 1,
  merchant          text,
  note              text,
  occurred_at       timestamptz not null default now(),
  source            text not null default 'manual'
                    check (source in ('manual','quickadd','import')),
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index transactions_user_date_idx     on public.transactions (user_id, occurred_at desc);
create index transactions_user_cat_idx      on public.transactions (user_id, category_id);
create index transactions_user_merchant_idx on public.transactions (user_id, lower(merchant));

-- ---------- budgets ----------
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete cascade, -- null = overall
  month        date not null check (month = date_trunc('month', month)::date),
  limit_amount bigint not null check (limit_amount >= 0),
  rollover     boolean not null default false,
  unique nulls not distinct (user_id, category_id, month)
);
create index budgets_user_month_idx on public.budgets (user_id, month);

-- ---------- learned categorization ----------
create table public.merchant_map (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pattern     text not null,          -- lowercase keyword
  category_id uuid not null references public.categories(id) on delete cascade,
  hit_count   int  not null default 1,
  unique (user_id, pattern)
);

-- ---------- fx rates (shared; written by an edge function with the service role) ----------
create table public.fx_rates (
  base       char(3) not null,
  quote      char(3) not null,
  rate       numeric(18,8) not null,
  fetched_at timestamptz not null default now(),
  primary key (base, quote)
);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------- new user → profile + default categories + cash account ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.categories (user_id, name, icon, color, kind, sort_order) values
    (new.id, 'Food & Dining',   'utensils',      '#F97316', 'expense', 1),
    (new.id, 'Groceries',       'shopping-cart', '#22C55E', 'expense', 2),
    (new.id, 'Transport',       'car',           '#3B82F6', 'expense', 3),
    (new.id, 'Rent & Bills',    'home',          '#8B5CF6', 'expense', 4),
    (new.id, 'Shopping',        'shopping-bag',  '#EC4899', 'expense', 5),
    (new.id, 'Health',          'heart-pulse',   '#EF4444', 'expense', 6),
    (new.id, 'Entertainment',   'clapperboard',  '#F59E0B', 'expense', 7),
    (new.id, 'Subscriptions',   'repeat',        '#06B6D4', 'expense', 8),
    (new.id, 'Money Sent Home', 'send',          '#14B8A6', 'expense', 9),
    (new.id, 'Other',           'circle',        '#64748B', 'expense', 10),
    (new.id, 'Salary',          'briefcase',     '#16A34A', 'income',  1),
    (new.id, 'Other Income',    'plus-circle',   '#0EA5E9', 'income',  2);

  insert into public.accounts (user_id, name, type, currency)
  values (new.id, 'Cash', 'cash', 'QAR');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.categories      enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions    enable row level security;
alter table public.budgets         enable row level security;
alter table public.merchant_map    enable row level security;
alter table public.fx_rates        enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own recurring_rules" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own merchant_map" on public.merchant_map
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fx readable by signed-in users" on public.fx_rates
  for select to authenticated using (true);
