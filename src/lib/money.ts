// Money is stored as integers in minor units (15.50 QAR → 1550). Never floats.

const MINOR_DIGITS: Record<string, number> = { KWD: 3, BHD: 3, OMR: 3, JOD: 3 }

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency.toUpperCase()] ?? 2
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorDigits(currency))
}

export function fromMinor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorDigits(currency)
}

export function formatMinor(
  amountMinor: number,
  currency: string,
  opts: { locale?: string; compact?: boolean; signed?: boolean } = {},
): string {
  const digits = minorDigits(currency)
  const value = fromMinor(amountMinor, currency)
  const formatted = new Intl.NumberFormat(opts.locale ?? 'en-QA', {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.compact ? 0 : digits,
    maximumFractionDigits: digits,
    notation: opts.compact ? 'compact' : 'standard',
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }).format(value)
  return formatted
}

export function convertMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  if (fromCurrency === toCurrency) return amountMinor
  const value = fromMinor(amountMinor, fromCurrency) * rate
  return toMinor(value, toCurrency)
}
