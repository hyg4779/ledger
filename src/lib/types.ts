export type TxType = 'income' | 'expense'

export interface Category {
  id: string
  type: TxType
  name: string
  emoji: string
  /** 월 예산(원). 지출 카테고리에만 의미가 있다. */
  budget?: number
  /** 숨긴 카테고리는 입력 목록에서 빠지지만 과거 내역에는 그대로 표시된다. */
  hidden?: boolean
}

export interface Transaction {
  id: string
  type: TxType
  /** 항상 양수(원). 수입/지출 구분은 type이 한다. */
  amount: number
  categoryId: string
  /** YYYY-MM-DD */
  date: string
  memo: string
  createdAt: number
  /** 대출이자 지출이면 어느 대출의 이자인지 */
  loanId?: string
}

export type LoanKind = 'jeonse' | 'mortgage' | 'credit' | 'invest' | 'car' | 'student' | 'etc'

/** 만기일시(이자만 내다 만기에 원금) / 원리금균등 / 원금균등 */
export type RepaymentType = 'bullet' | 'equalPayment' | 'equalPrincipal'

export interface Loan {
  id: string
  name: string
  kind: LoanKind
  lender: string
  /** 최초 대출금(원) */
  principal: number
  /** 이 앱에 등록할 때의 잔액(원). 현재 잔액 = 이 값 − 이후 원금 상환 합계 */
  openingBalance: number
  /** 연 금리(%) */
  rate: number
  repayment: RepaymentType
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD */
  maturityDate: string
  /** 매달 납부일 (1~31) */
  paymentDay: number
  memo: string
  /** 상환 완료로 닫은 대출 */
  closed?: boolean
  createdAt: number
}

/** 대출 납부 1회. 이자는 지출 기록(interestTxId)으로, 원금 상환은 여기에 남긴다. */
export interface LoanPayment {
  id: string
  loanId: string
  /** YYYY-MM-DD */
  date: string
  /** 원금 상환액(원). 지출이 아니라 빚이 줄어든 것이므로 지출 통계에 넣지 않는다. */
  principal: number
  interestTxId?: string
  createdAt: number
}

export type ThemeMode = 'system' | 'light' | 'dark'

export interface LedgerData {
  version: 1
  categories: Category[]
  transactions: Transaction[]
  /** 전체 월 예산(원). 0 또는 undefined면 사용 안 함. */
  monthlyBudget?: number
  theme: ThemeMode
  loans: Loan[]
  loanPayments: LoanPayment[]
}
