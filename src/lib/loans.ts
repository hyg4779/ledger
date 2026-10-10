import type { LedgerData, Loan, LoanKind, LoanPayment, RepaymentType, Transaction } from './types'

export const LOAN_INTEREST_CATEGORY = 'exp-loan'

export const LOAN_KINDS: Record<LoanKind, { label: string; emoji: string }> = {
  jeonse: { label: '전세자금대출', emoji: '🏠' },
  mortgage: { label: '주택담보대출', emoji: '🏡' },
  credit: { label: '신용대출', emoji: '💳' },
  overdraft: { label: '마이너스통장', emoji: '➖' },
  invest: { label: '투자용 대출', emoji: '📈' },
  car: { label: '자동차 대출', emoji: '🚗' },
  student: { label: '학자금 대출', emoji: '🎓' },
  etc: { label: '기타 대출', emoji: '🏦' },
}

export const REPAYMENT_LABELS: Record<RepaymentType, string> = {
  bullet: '만기일시상환',
  equalPayment: '원리금균등상환',
  equalPrincipal: '원금균등상환',
}

export const REPAYMENT_HINTS: Record<RepaymentType, string> = {
  bullet: '매달 이자만 내고 만기에 원금을 한 번에 갚아요 (전세대출에 흔해요)',
  equalPayment: '매달 같은 금액(원금+이자)을 내요',
  equalPrincipal: '매달 같은 원금에 남은 잔액만큼의 이자를 더해 내요',
}

/** 대출별 원금 상환 합계 */
export function repaidPrincipal(loanId: string, payments: LoanPayment[]): number {
  return payments.reduce((a, p) => (p.loanId === loanId ? a + p.principal : a), 0)
}

export function currentBalance(loan: Loan, payments: LoanPayment[]): number {
  return Math.max(0, loan.openingBalance - repaidPrincipal(loan.id, payments))
}

/** 기준일부터 만기까지 남은 개월 수(이번 달 납부 포함, 최소 1) */
export function remainingMonths(loan: Loan, from = new Date()): number {
  const [y, m, d] = loan.maturityDate.split('-').map(Number)
  let months = (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth())
  if (d >= from.getDate()) months += 1
  return Math.max(1, months)
}

/** 만기까지 남은 날 (지났으면 음수) */
export function daysToMaturity(loan: Loan, from = new Date()): number {
  const [y, m, d] = loan.maturityDate.split('-').map(Number)
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000)
}

/**
 * 이번 달 예상 납부액. 실제 은행 계산(일할 계산·우대금리 등)과 몇 천 원 차이가 날 수 있어
 * 화면에서는 항상 '예상'으로 표시하고, 납부 기록 때 실제 금액으로 고쳐 쓰게 한다.
 */
export function expectedPayment(loan: Loan, balance: number, from = new Date()): { interest: number; principal: number } {
  if (balance <= 0) return { interest: 0, principal: 0 }
  const r = loan.rate / 100 / 12
  const interest = Math.round(balance * r)
  const n = remainingMonths(loan, from)
  // 마이너스통장은 쓴 금액에 이자만 붙고 정해진 원금 상환이 없다.
  if (loan.kind === 'overdraft') return { interest, principal: 0 }
  if (loan.repayment === 'bullet') return { interest, principal: n === 1 ? balance : 0 }
  if (loan.repayment === 'equalPrincipal') return { interest, principal: Math.round(balance / n) }
  // 원리금균등: 남은 잔액·기간으로 매달 같은 금액 M을 다시 계산
  const total = r === 0 ? balance / n : (balance * r) / (1 - (1 + r) ** -n)
  return { interest, principal: Math.min(balance, Math.round(total - interest)) }
}

/** 해당 기간에 대출별로 실제 낸 이자 (지출 기록 기준) */
export function interestByLoan(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || t.categoryId !== LOAN_INTEREST_CATEGORY) continue
    const key = t.loanId ?? ''
    map.set(key, (map.get(key) ?? 0) + t.amount)
  }
  return map
}

export function activeLoans(data: LedgerData): Loan[] {
  return data.loans.filter((l) => !l.closed)
}

/** 잔액 가중 평균 금리 */
export function weightedRate(loans: { loan: Loan; balance: number }[]): number {
  const total = loans.reduce((a, l) => a + l.balance, 0)
  return total ? loans.reduce((a, l) => a + l.loan.rate * l.balance, 0) / total : NaN
}

/** 특정 날짜(포함) 기준 잔액. 시작일 전이면 0 */
export function balanceAt(loan: Loan, payments: LoanPayment[], dateKey: string): number {
  if (dateKey < loan.startDate) return 0
  const changed = payments.reduce((a, p) => (p.loanId === loan.id && p.date <= dateKey ? a + p.principal : a), 0)
  return Math.max(0, loan.openingBalance - changed)
}

/**
 * 월말 기준 대출별 잔액 이력. 가장 이른 시작일·기록 중 늦은 쪽부터 이번 달까지(최대 maxMonths개월).
 * values[월][대출] 형태로 돌려준다.
 */
export function monthlyLoanBalances(loans: Loan[], payments: LoanPayment[], maxMonths = 24) {
  const now = new Date()
  const months: string[] = []
  for (let i = maxMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthEnd = (m: string) => {
    const [y, mo] = m.split('-').map(Number)
    const last = new Date(y, mo, 0).getDate()
    return `${m}-${String(last).padStart(2, '0')}`
  }
  const rows = months.map((m) => loans.map((l) => balanceAt(l, payments, monthEnd(m))))
  // 앞쪽의 '전부 0'인 달은 잘라낸다.
  const first = rows.findIndex((r) => r.some((v) => v > 0))
  return first < 0 ? { months: [], values: [] } : { months: months.slice(first), values: rows.slice(first) }
}
