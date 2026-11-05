export type Profile = {
  id: string
  display_name: string | null
  home_currency: string
  salary_day: number | null
  monthly_income: number | null
  monthly_budget: number | null
  report_frequency: 'daily' | 'weekly' | 'monthly'
  report_hour: number
  timezone: string
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type Account = {
  id: string
  user_id: string
  name: string
  type: 'cash' | 'bank' | 'card'
  currency: string
  color: string | null
  is_archived: boolean
  opening_balance: number
  opening_balance_at: string
  is_default: boolean
  created_at: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  kind: 'expense' | 'income'
  sort_order: number
}

export type TransactionType = 'expense' | 'income' | 'transfer'

export type Transaction = {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  type: TransactionType
  amount: number
  currency: string
  amount_home: number
  fx_rate: number
  merchant: string | null
  note: string | null
  occurred_at: string
  source: 'manual' | 'quickadd' | 'import'
  recurring_rule_id: string | null
  created_at: string
  updated_at: string
}

export type MerchantMapRow = {
  id: string
  user_id: string
  pattern: string
  category_id: string
  hit_count: number
}

export const CURRENCIES = [
  'QAR', 'USD', 'LBP', 'EUR', 'GBP', 'AED', 'SAR', 'KWD', 'BHD', 'OMR', 'JOD', 'EGP', 'TRY', 'INR', 'PKR', 'PHP',
] as const

export const CATEGORY_COLORS = [
  '#F97316', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#06B6D4', '#14B8A6', '#64748B', '#16A34A', '#0EA5E9', '#A855F7', '#EAB308',
] as const

export type Budget = {
  id: string
  user_id: string
  category_id: string | null // null = overall monthly budget
  month: string // YYYY-MM-01
  limit_amount: number
  rollover: boolean
}

export type IncomeSource = {
  id: string
  user_id: string
  name: string
  amount: number
  currency: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type SavingsRow = {
  id: string
  user_id: string
  month: string // YYYY-MM-01
  amount: number
  note: string | null
  created_at: string
}
