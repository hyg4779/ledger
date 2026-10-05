import type { Category, LedgerData } from './types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', type: 'expense', name: '식비', emoji: '🍚' },
  { id: 'exp-cafe', type: 'expense', name: '카페·간식', emoji: '☕' },
  { id: 'exp-living', type: 'expense', name: '생활용품', emoji: '🧻' },
  { id: 'exp-transport', type: 'expense', name: '교통', emoji: '🚇' },
  { id: 'exp-housing', type: 'expense', name: '주거·관리비', emoji: '🏠' },
  { id: 'exp-telecom', type: 'expense', name: '통신·구독', emoji: '📱' },
  { id: 'exp-shopping', type: 'expense', name: '쇼핑', emoji: '🛍️' },
  { id: 'exp-health', type: 'expense', name: '의료·건강', emoji: '💊' },
  { id: 'exp-culture', type: 'expense', name: '문화·여가', emoji: '🎬' },
  { id: 'exp-social', type: 'expense', name: '경조사·선물', emoji: '🎁' },
  { id: 'exp-insurance', type: 'expense', name: '보험', emoji: '🛡️' },
  { id: 'exp-loan', type: 'expense', name: '대출이자', emoji: '🏦' },
  { id: 'exp-education', type: 'expense', name: '교육·자기계발', emoji: '📚' },
  { id: 'exp-etc', type: 'expense', name: '기타 지출', emoji: '📦' },
  { id: 'inc-salary', type: 'income', name: '급여', emoji: '💼' },
  { id: 'inc-bonus', type: 'income', name: '상여', emoji: '🎉' },
  { id: 'inc-side', type: 'income', name: '부수입', emoji: '💡' },
  { id: 'inc-interest', type: 'income', name: '이자·배당', emoji: '📈' },
  { id: 'inc-etc', type: 'income', name: '기타 수입', emoji: '💰' },
]

export function createInitialData(): LedgerData {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    theme: 'system',
    loans: [],
    loanPayments: [],
  }
}
