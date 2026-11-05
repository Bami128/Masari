<p align="center">
  <img src="public/icons/icon-192.png" width="96" alt="Masari" />
</p>

<h1 align="center">Masari</h1>

<p align="center">
  A budget &amp; expense tracker built for the Gulf — multi-currency, offline-first, private.<br/>
  Web app / PWA. Works on iPhone, Android and desktop.
</p>

---

## Features

- **Quick Add** — type `coffee 15`, `uber 32 usd`, `+12000 salary` → parsed, categorised, saved in one tap. Learns your merchants.
- **Instant & offline** — saves appear immediately; with no signal they queue on the device and sync when you're back.
- **Budget** (mirrors a classic Excel budget) — income sources, overall + per-category planned / spent / left, copy last month.
- **Home** — left to spend this month, safe-to-spend today, should-save, % of income spent, category bars.
- **Accounts & balances** — set what's in each account; income and expenses move it from there.
- **Reports** — category × month year grid; savings forecast vs actual with manual override.
- **Multi-currency** — QAR / USD / LBP / EUR / … with live daily rates (pegs kept exact).
- **Export** — CSV of transactions, full JSON backup, via the share sheet.
- **App lock** — PIN + Face ID / fingerprint, auto-lock in background. Device-local.
- **Security** — Postgres row-level security, Google-only sign-in, strict CSP, no analytics, no third-party scripts.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · TanStack Query · React Router · Supabase (Postgres + Auth) · Recharts · Cloudflare Pages

## Project layout

```
src/
  app/            router, AppShell (sidebar ≥ md, bottom tabs < md), query client
  components/     Button, Card, Sheet, Field, MoneyInput, ProgressBar, Logo, …
  features/
    auth/         Google sign-in, session, route guards
    onboarding/   first-run setup
    quickadd/     natural-language add (parser in lib/quickAdd.ts)
    transactions/ list, edit sheet, hooks (optimistic + offline outbox)
    budgets/      month budgets (overall + per category)
    income/       income sources
    savings/      per-month savings with override
    accounts/     balances, default account, "log salary"
    reports/      year grid + savings chart (lazy-loaded)
    settings/     profile, categories, accounts, data export, FX status
    lock/         PIN / biometric app lock
    fx/           live exchange-rate provider
    sync/         outbox replay + offline chip
  lib/            supabase client, money (integer minor units), fx, dates, outbox, lock, download
supabase/
  migrations/     0001_init, 0002_income_savings, 0003_account_balances
public/
  _headers        Cloudflare security headers (CSP, HSTS, …)
  _redirects      SPA fallback
  icons/          PWA icons
```

## Running locally

```bash
npm install
cp .env.example .env.local      # add your Supabase URL + publishable key
npm run dev
```

## Deploying

1. **Supabase** — create a project, run the files in `supabase/migrations/` in order (SQL Editor), enable the Google provider, set Site URL + Redirect URL (`/auth/callback`).
2. **Cloudflare Pages** — connect this repo. Build command `npm run build`, output `dist`. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=22`.
3. Update `connect-src` in `public/_headers` if your Supabase project URL differs.

## Money handling

All amounts are stored as **integers in minor units** (`1550` = 15.50 QAR). Never floats. See `src/lib/money.ts`.

## Licence

MIT — see [LICENSE](LICENSE).
