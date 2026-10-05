import { toDateKey } from './dates'
import { expectedPayment, LOAN_INTEREST_CATEGORY } from './loans'
import { newId } from './store'
import type { Loan, LoanPayment, Transaction, TxType } from './types'

/** 시드 고정 난수 — 예시 데이터가 매번 같게 나오도록 */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/** 오늘 기준 최근 14개월치 예시 내역 + 대출 2건과 매달 납부 기록 */
export function buildSampleData(): { transactions: Transaction[]; loans: Loan[]; loanPayments: LoanPayment[] } {
  const rand = rng(20261005)
  const txs: Transaction[] = []
  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 13, 1)
  const ymd = (d: Date) => toDateKey(d)
  const plusMonths = (months: number, day: number) => new Date(firstMonth.getFullYear(), firstMonth.getMonth() + months, day)
  const loans: Loan[] = [
    {
      id: newId(),
      name: '전세자금대출',
      kind: 'jeonse',
      lender: '예시은행',
      principal: 150_000_000,
      openingBalance: 150_000_000,
      rate: 3.8,
      repayment: 'bullet',
      startDate: ymd(plusMonths(-3, 1)),
      maturityDate: ymd(plusMonths(21, 0)),
      paymentDay: 27,
      memo: '예시 데이터',
      createdAt: now.getTime(),
    },
    {
      id: newId(),
      name: '신용대출',
      kind: 'credit',
      lender: '예시은행',
      principal: 30_000_000,
      openingBalance: 26_000_000,
      rate: 5.2,
      repayment: 'equalPayment',
      startDate: ymd(plusMonths(-6, 10)),
      maturityDate: ymd(plusMonths(30, 10)),
      paymentDay: 10,
      memo: '예시 데이터',
      createdAt: now.getTime(),
    },
  ]
  const loanPayments: LoanPayment[] = []
  const repaid = new Map<string, number>()
  const push = (date: Date, type: TxType, categoryId: string, amount: number, memo: string) => {
    if (date > now) return
    txs.push({
      id: newId(),
      type,
      categoryId,
      amount: Math.round(amount / 100) * 100,
      date: toDateKey(date),
      memo,
      createdAt: date.getTime(),
    })
  }

  for (let back = 13; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const y = first.getFullYear()
    const m = first.getMonth()
    const days = new Date(y, m + 1, 0).getDate()
    const day = (d: number) => new Date(y, m, Math.min(d, days))

    push(day(25), 'income', 'inc-salary', 3_400_000, '월급')
    if (m === 0 || m === 6) push(day(25), 'income', 'inc-bonus', 1_500_000, '상여금')
    if (rand() < 0.4) push(day(10 + Math.floor(rand() * 15)), 'income', 'inc-side', 150_000 + rand() * 300_000, '부업')
    push(day(20), 'income', 'inc-interest', 20_000 + rand() * 30_000, '예금 이자')

    push(day(5), 'expense', 'exp-housing', 120_000 + rand() * 60_000, '관리비')
    push(day(10), 'expense', 'exp-telecom', 55_000, '휴대폰 요금')
    push(day(15), 'expense', 'exp-telecom', 17_000, 'OTT 구독')
    push(day(12), 'expense', 'exp-insurance', 98_000, '실손보험')
    for (const loan of loans) {
      const date = day(loan.paymentDay)
      if (date > now) continue
      const balance = loan.openingBalance - (repaid.get(loan.id) ?? 0)
      const { interest, principal } = expectedPayment(loan, balance, date)
      const txId = newId()
      txs.push({
        id: txId,
        type: 'expense',
        amount: interest,
        categoryId: LOAN_INTEREST_CATEGORY,
        date: toDateKey(date),
        memo: `${loan.name} 이자`,
        createdAt: date.getTime(),
        loanId: loan.id,
      })
      loanPayments.push({ id: newId(), loanId: loan.id, date: toDateKey(date), principal, interestTxId: txId, createdAt: date.getTime() })
      repaid.set(loan.id, (repaid.get(loan.id) ?? 0) + principal)
    }

    for (let d = 1; d <= days; d++) {
      if (rand() < 0.75) push(day(d), 'expense', 'exp-food', 8_000 + rand() * 22_000, rand() < 0.5 ? '점심' : '저녁')
      if (rand() < 0.45) push(day(d), 'expense', 'exp-cafe', 3_500 + rand() * 6_000, '커피')
      if (rand() < 0.6) push(day(d), 'expense', 'exp-transport', 1_500 + rand() * 4_000, '교통')
    }
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++)
      push(day(1 + Math.floor(rand() * days)), 'expense', 'exp-shopping', 20_000 + rand() * 120_000, '온라인 쇼핑')
    for (let i = 0; i < 2; i++)
      push(day(1 + Math.floor(rand() * days)), 'expense', 'exp-living', 10_000 + rand() * 40_000, '생필품')
    if (rand() < 0.5) push(day(1 + Math.floor(rand() * days)), 'expense', 'exp-health', 15_000 + rand() * 60_000, '병원')
    if (rand() < 0.7) push(day(1 + Math.floor(rand() * days)), 'expense', 'exp-culture', 15_000 + rand() * 80_000, '영화·전시')
    if (rand() < 0.35) push(day(1 + Math.floor(rand() * days)), 'expense', 'exp-social', 50_000 + rand() * 100_000, '경조사')
  }
  return { transactions: txs, loans, loanPayments }
}
