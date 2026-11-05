import { addMonths, endOfMonth, format, isSameDay, isToday, isYesterday, startOfMonth } from 'date-fns'

export function monthKey(d: Date): string {
  return format(d, 'yyyy-MM')
}

export function monthRange(d: Date): { from: Date; to: Date } {
  return { from: startOfMonth(d), to: endOfMonth(d) }
}

export function shiftMonth(d: Date, delta: number): Date {
  return addMonths(d, delta)
}

export function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, d MMM')
}

export function monthLabel(d: Date): string {
  return format(d, 'MMMM yyyy')
}

export function toDateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function fromDateInputValue(value: string, keepTimeFrom?: Date): Date {
  const [y, m, d] = value.split('-').map(Number)
  const base = keepTimeFrom ?? new Date()
  const out = new Date(y, m - 1, d, base.getHours(), base.getMinutes(), base.getSeconds())
  if (keepTimeFrom && isSameDay(out, keepTimeFrom)) return keepTimeFrom
  return out
}

/** First day of the month as the DB stores it: YYYY-MM-01 */
export function monthStartKey(d: Date): string {
  return `${format(d, 'yyyy-MM')}-01`
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** Days left in the month including today. */
export function daysLeftInMonth(d: Date): number {
  return daysInMonth(d) - d.getDate() + 1
}

export function monthsOfYear(year: number): Date[] {
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
}

export function shortMonth(d: Date): string {
  return format(d, 'MMM')
}
