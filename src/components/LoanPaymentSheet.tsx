import { useMemo, useState } from 'react'
import { daysInMonth, currentMonthKey, dayLabel, todayKey } from '../lib/dates'
import { formatNumber, formatWon, parseAmount } from '../lib/format'
import { currentBalance, expectedPayment, LOAN_KINDS } from '../lib/loans'
import { actions, useLedger } from '../lib/store'
import type { Loan } from '../lib/types'

interface Props {
  loan: Loan
  onClose: () => void
}

/** 이번 달 납부일(오늘 이전이면) 또는 오늘 */
function defaultPaymentDate(loan: Loan): string {
  const month = currentMonthKey()
  const day = Math.min(loan.paymentDay, daysInMonth(month))
  const candidate = `${month}-${String(day).padStart(2, '0')}`
  return candidate <= todayKey() ? candidate : todayKey()
}

export function LoanPaymentSheet({ loan, onClose }: Props) {
  const { data } = useLedger()
  const balance = currentBalance(loan, data.loanPayments)
  const expected = expectedPayment(loan, balance)
  const [date, setDate] = useState(defaultPaymentDate(loan))
  const [interestText, setInterestText] = useState(expected.interest ? formatNumber(expected.interest) : '')
  const [principalText, setPrincipalText] = useState(expected.principal ? formatNumber(expected.principal) : '')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  const txById = useMemo(() => new Map(data.transactions.map((t) => [t.id, t])), [data.transactions])
  const history = useMemo(
    () =>
      data.loanPayments
        .filter((p) => p.loanId === loan.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 12),
    [data.loanPayments, loan.id],
  )

  const interest = parseAmount(interestText)
  const principal = parseAmount(principalText)

  function save() {
    if (interest <= 0 && principal <= 0) return setError('이자나 원금 중 하나는 입력해 주세요')
    if (principal > balance) return setError(`원금 상환액이 남은 잔액(${formatWon(balance)})보다 커요`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('날짜를 확인해 주세요')
    actions.recordLoanPayment({ loan, date, interest, principal, memo: memo.trim() })
    onClose()
  }

  const numberField = (value: string, set: (v: string) => void) => ({
    inputMode: 'numeric' as const,
    value,
    placeholder: '0',
    onChange: (e: { target: { value: string } }) => {
      const n = parseAmount(e.target.value)
      set(n ? formatNumber(n) : '')
      setError('')
    },
  })

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="대출 납부 기록" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button type="button" className="text-btn" onClick={onClose}>
            취소
          </button>
          <h2>납부 기록</h2>
          <button type="button" className="text-btn strong" onClick={save}>
            저장
          </button>
        </div>

        <div className="loan-mini">
          <span className="tx-emoji" aria-hidden>
            {LOAN_KINDS[loan.kind].emoji}
          </span>
          <div>
            <b>{loan.name}</b>
            <span>
              잔액 {formatWon(balance)} · 연 {loan.rate}%
            </span>
          </div>
        </div>

        <label className="field">
          <span className="field-label">납부일</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="two-col">
          <label className="field">
            <span className="field-label">이자 (원)</span>
            <input {...numberField(interestText, setInterestText)} />
          </label>
          <label className="field">
            <span className="field-label">원금 상환 (원)</span>
            <input {...numberField(principalText, setPrincipalText)} />
          </label>
        </div>
        <p className="hint">
          예상 금액으로 미리 채워 두었어요. 은행 앱의 실제 납부액으로 고쳐 주세요.
          <br />
          이자는 <b>지출(대출이자)</b>로, 원금 상환은 <b>잔액 차감</b>으로만 반영돼요.
        </p>
        <label className="field">
          <span className="field-label">메모 (선택)</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={`${loan.name} 이자`} maxLength={40} />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button type="button" className="primary-btn" onClick={save}>
          납부 기록 저장
        </button>

        {history.length > 0 && (
          <>
            <div className="field-label">최근 납부 기록</div>
            <ul className="pay-history">
              {history.map((p) => {
                const tx = p.interestTxId ? txById.get(p.interestTxId) : undefined
                return (
                  <li key={p.id}>
                    <span className="pay-date">{dayLabel(p.date)}</span>
                    <span className="pay-amts">
                      이자 {formatWon(tx?.amount ?? 0)}
                      {p.principal > 0 && <> · 원금 {formatWon(p.principal)}</>}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="이 납부 기록 삭제"
                      onClick={() => {
                        if (window.confirm('이 납부 기록을 삭제할까요? 함께 기록된 이자 지출도 지워지고, 원금 상환만큼 잔액이 다시 늘어나요.'))
                          actions.deleteLoanPayment(p.id)
                      }}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
