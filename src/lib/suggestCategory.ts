import type { Category, MerchantMapRow } from './types'

// Built-in keyword → category name hints. Only used when the user has no learned mapping.
const BUILTIN: Array<[RegExp, string]> = [
  [/\b(coffee|starbucks|costa|tim hortons|caribou|cafe|caf[eé]|tea|karak|chai)\b/i, 'Food & Dining'],
  [/\b(lunch|dinner|breakfast|restaurant|shawarma|burger|pizza|sushi|talabat|snoonu|rafeeq|deliveroo|mcdonald|kfc|food)\b/i, 'Food & Dining'],
  [/\b(grocer|carrefour|lulu|monoprix|spinneys|al meera|meera|supermarket|market)\b/i, 'Groceries'],
  [/\b(uber|karwa|careem|taxi|metro|bus|petrol|fuel|woqod|parking|gas)\b/i, 'Transport'],
  [/\b(rent|electricity|kahramaa|water|internet|ooredoo|vodafone|wifi|bill|bills)\b/i, 'Rent & Bills'],
  [/\b(amazon|noon|shein|zara|h&m|ikea|clothes|shoes|mall|shopping)\b/i, 'Shopping'],
  [/\b(pharmacy|doctor|clinic|hospital|dentist|gym|medicine|hamad)\b/i, 'Health'],
  [/\b(cinema|movie|vox|novo|game|games|steam|playstation|concert|ticket)\b/i, 'Entertainment'],
  [/\b(netflix|spotify|youtube|icloud|apple|google one|chatgpt|subscription|prime)\b/i, 'Subscriptions'],
  [/\b(sent home|remit|remittance|western union|omt|whish|transfer home|family)\b/i, 'Money Sent Home'],
  [/\b(salary|payroll|wage)\b/i, 'Salary'],
]

export function suggestCategory(
  merchant: string,
  kind: 'expense' | 'income',
  categories: Category[],
  learned: MerchantMapRow[],
): Category | null {
  const m = merchant.trim().toLowerCase()
  if (!m) return null

  const ofKind = categories.filter((c) => c.kind === kind)

  // 1. learned mapping: longest matching pattern wins
  const hits = learned
    .filter((row) => row.pattern && m.includes(row.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length || b.hit_count - a.hit_count)
  for (const h of hits) {
    const cat = ofKind.find((c) => c.id === h.category_id)
    if (cat) return cat
  }

  // 2. built-in keywords
  for (const [re, name] of BUILTIN) {
    if (re.test(m)) {
      const cat = ofKind.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (cat) return cat
    }
  }

  // 3. income with one obvious bucket
  if (kind === 'income') {
    return ofKind.find((c) => c.name === 'Other Income') ?? ofKind[0] ?? null
  }

  return null
}
