// Masari Quick Add parser
//
//   "coffee 15"          → expense  1500    null  "coffee"
//   "uber 32 usd"        → expense  3200    USD   "uber"
//   "$12 lunch"          → expense  1200    USD   "lunch"
//   "+12000 salary"      → income   1200000 null  "salary"
//   "salary 12,000"      → income   1200000 null  "salary"   (keyword)
//   "rent 3.5k"          → expense  350000  null  "rent"
//   "15 coffee"          → expense  1500    null  "coffee"
//   "taxi 20 qr"         → expense  2000    QAR   "taxi"
//   "sent home 500 usd"  → expense  50000   USD   "sent home"
//
// currency === null → caller substitutes the user's home currency.

import { minorDigits } from './money'

export type QuickAddResult = {
  type: 'expense' | 'income'
  amountMinor: number
  currency: string | null
  merchant: string
  raw: string
}

const CURRENCY_ALIASES: Record<string, string> = {
  qar: 'QAR', qr: 'QAR', riyal: 'QAR', riyals: 'QAR',
  usd: 'USD', $: 'USD', dollar: 'USD', dollars: 'USD',
  lbp: 'LBP', ll: 'LBP', lira: 'LBP',
  eur: 'EUR', '€': 'EUR', euro: 'EUR', euros: 'EUR',
  gbp: 'GBP', '£': 'GBP',
  aed: 'AED', sar: 'SAR', kwd: 'KWD', bhd: 'BHD', omr: 'OMR',
  jod: 'JOD', egp: 'EGP', try: 'TRY', inr: 'INR', pkr: 'PKR', php: 'PHP',
}

const INCOME_WORDS = /\b(salary|income|refund|received|bonus|paid me|cashback|dividend)\b/i
const FILLER_WORDS = /^(for|on|at|to|from|in)\s+/i

const AMOUNT_RE =
  /(^|\s)([+-])?\s*([$€£])?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,3}))?(k(?=$|\s))?/gi

const CURRENCY_AFTER_RE = /^\s*([a-z]{2,7}|[$€£])(?=$|\s)/i
const CURRENCY_BEFORE_RE = /(?:^|\s)([a-z]{2,7}|[$€£])\s*$/i

type Candidate = {
  start: number
  end: number
  sign?: string
  intPart: string
  fracPart?: string
  kSuffix?: string
  currency: string | null
}

function findAmount(raw: string): Candidate | null {
  const candidates: Candidate[] = []
  AMOUNT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = AMOUNT_RE.exec(raw)) !== null) {
    const [, lead, sign, symBefore, intPart, fracPart, kSuffix] = m
    const start = m.index + lead.length
    let end = m.index + m[0].length
    let currency: string | null = symBefore ? CURRENCY_ALIASES[symBefore] ?? null : null

    // Currency code right after the number ("32 usd")
    const after = raw.slice(end)
    const am = CURRENCY_AFTER_RE.exec(after)
    if (am) {
      const alias = CURRENCY_ALIASES[am[1].toLowerCase()]
      if (alias) {
        if (!currency) currency = alias
        end += am[0].length
      } else if (/^[a-z]/i.test(after)) {
        // Number glued to a non-currency word ("3pm", "2nd") → not an amount
        continue
      }
    }

    // Currency code right before the number ("kwd 5.250", "usd 20")
    let s = start
    if (!currency && !symBefore) {
      const bm = CURRENCY_BEFORE_RE.exec(raw.slice(0, start))
      if (bm) {
        const alias = CURRENCY_ALIASES[bm[1].toLowerCase()]
        if (alias) {
          currency = alias
          s = start - bm[0].length + (bm[0].startsWith(' ') ? 1 : 0)
        }
      }
    }

    candidates.push({ start: s, end, sign, intPart, fracPart, kSuffix, currency })
  }
  if (candidates.length === 0) return null
  // Prefer an explicitly signed or currency-tagged number; otherwise the last number wins
  // ("dinner for 2 at 120" → 120).
  const tagged = candidates.filter((c) => c.sign || c.currency)
  return (tagged.length ? tagged : candidates).at(-1) ?? null
}

export function parseQuickAdd(input: string, homeCurrency = 'QAR'): QuickAddResult | null {
  const raw = input.trim().replace(/\s+/g, ' ')
  if (!raw) return null

  const c = findAmount(raw)
  if (!c) return null

  const currency = c.currency
  const digits = minorDigits(currency ?? homeCurrency)
  let whole = c.intPart.replace(/,/g, '')
  let frac = (c.fracPart ?? '').padEnd(digits, '0').slice(0, digits)

  if (c.kSuffix) {
    whole = (whole + (c.fracPart ?? '').padEnd(3, '0').slice(0, 3)).replace(/^0+(?=\d)/, '')
    frac = ''.padEnd(digits, '0')
  }

  const amountMinor = Number(whole + frac)
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null

  const merchant = (raw.slice(0, c.start) + ' ' + raw.slice(c.end))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FILLER_WORDS, '')
    .replace(/\s+(for|on|at|to|from|in)$/i, '')
    .trim()

  const type: QuickAddResult['type'] =
    c.sign === '+' || INCOME_WORDS.test(merchant) ? 'income' : 'expense'

  return { type, amountMinor, currency, merchant, raw }
}
