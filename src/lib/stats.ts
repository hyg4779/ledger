import { daysInMonth, type MonthKey } from './dates'
import type { Transaction, TxType } from './types'

export interface Totals {
  income: number
  expense: number
}

export function totals(txs: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense }
}

/** 저축률 = (수입 - 지출) / 수입. 수입이 없으면 NaN */
export function savingsRate(t: Totals): number {
  return t.income > 0 ? (t.income - t.expense) / t.income : NaN
}

export function inMonth(txs: Transaction[], month: MonthKey): Transaction[] {
  return txs.filter((t) => t.date.startsWith(month))
}

export function inYear(txs: Transaction[], year: number): Transaction[] {
  const prefix = `${year}-`
  return txs.filter((t) => t.date.startsWith(prefix))
}

export function byCategory(txs: Transaction[], type: TxType): { categoryId: string; total: number }[] {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== type) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  }
  return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}

/** 1~12월 수입·지출 합계 */
export function monthlyTotals(txs: Transaction[], year: number): Totals[] {
  const result: Totals[] = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }))
  for (const t of inYear(txs, year)) {
    const m = Number(t.date.slice(5, 7)) - 1
    if (t.type === 'income') result[m].income += t.amount
    else result[m].expense += t.amount
  }
  return result
}

/** 카테고리 × 월 지출 행렬 (해당 연도에 지출이 있는 카테고리만, 연간 합계 내림차순) */
export function categoryMonthMatrix(txs: Transaction[], year: number, type: TxType) {
  const rows = new Map<string, number[]>()
  for (const t of inYear(txs, year)) {
    if (t.type !== type) continue
    const row = rows.get(t.categoryId) ?? Array(12).fill(0)
    row[Number(t.date.slice(5, 7)) - 1] += t.amount
    rows.set(t.categoryId, row)
  }
  return [...rows.entries()]
    .map(([categoryId, months]) => ({ categoryId, months, total: months.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
}

/** 일별 누적 지출. 길이 = 해당 월 일수 */
export function cumulativeDailyExpense(txs: Transaction[], month: MonthKey): number[] {
  const days = daysInMonth(month)
  const daily = Array(days).fill(0)
  for (const t of inMonth(txs, month)) {
    if (t.type === 'expense') daily[Number(t.date.slice(8, 10)) - 1] += t.amount
  }
  let acc = 0
  return daily.map((v) => (acc += v))
}

export function yearsWithData(txs: Transaction[], ensure: number): number[] {
  const years = new Set<number>([ensure])
  for (const t of txs) years.add(Number(t.date.slice(0, 4)))
  return [...years].sort((a, b) => a - b)
}

export function yearlyTotals(txs: Transaction[]): { year: number; totals: Totals }[] {
  const map = new Map<number, Totals>()
  for (const t of txs) {
    const y = Number(t.date.slice(0, 4))
    const cur = map.get(y) ?? { income: 0, expense: 0 }
    if (t.type === 'income') cur.income += t.amount
    else cur.expense += t.amount
    map.set(y, cur)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, totals]) => ({ year, totals }))
}
