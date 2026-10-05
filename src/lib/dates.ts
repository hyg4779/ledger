const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** 'YYYY-MM' */
export type MonthKey = string

export function monthKeyOf(year: number, month: number): MonthKey {
  return `${year}-${pad(month)}`
}

export function currentMonthKey(): MonthKey {
  const d = new Date()
  return monthKeyOf(d.getFullYear(), d.getMonth() + 1)
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m }
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(key)
  const d = new Date(year, month - 1 + delta, 1)
  return monthKeyOf(d.getFullYear(), d.getMonth() + 1)
}

export function daysInMonth(key: MonthKey): number {
  const { year, month } = parseMonthKey(key)
  return new Date(year, month, 0).getDate()
}

export function monthLabel(key: MonthKey): string {
  const { year, month } = parseMonthKey(key)
  return `${year}년 ${month}월`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${wd})`
}
