import { useState, type ChangeEvent } from 'react'
import { todayKey } from '../lib/dates'
import { formatNumber, parseAmount } from '../lib/format'
import { LOAN_KINDS, REPAYMENT_HINTS, REPAYMENT_LABELS, repaidPrincipal } from '../lib/loans'
import { actions, newId, useLedger } from '../lib/store'
import type { Loan, LoanKind, RepaymentType } from '../lib/types'

interface Props {
  /** 수정할 대출. null이면 새로 등록 */
  editing: Loan | null
  onClose: () => void
}

export function LoanSheet({ editing, onClose }: Props) {
  const { data } = useLedger()
  const [kind, setKind] = useState<LoanKind>(editing?.kind ?? 'jeonse')
  const [name, setName] = useState(editing?.name ?? '')
  const [lender, setLender] = useState(editing?.lender ?? '')
  const [principalText, setPrincipalText] = useState(editing ? formatNumber(editing.principal) : '')
  const repaid = editing ? repaidPrincipal(editing.id, data.loanPayments) : 0
  const editingBalance = editing ? Math.max(0, editing.openingBalance - repaid) : 0
  const [balanceText, setBalanceText] = useState(editing ? formatNumber(editingBalance) : '')
  const [rateText, setRateText] = useState(editing ? String(editing.rate) : '')
  const [repayment, setRepayment] = useState<RepaymentType>(editing?.repayment ?? 'bullet')
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayKey())
  const [maturityDate, setMaturityDate] = useState(editing?.maturityDate ?? '')
  const [paymentDayText, setPaymentDayText] = useState(String(editing?.paymentDay ?? 25))
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [closed, setClosed] = useState(!!editing?.closed)
  const [error, setError] = useState('')
  const isOverdraft = kind === 'overdraft'

  const amountInput = (value: string, set: (v: string) => void) => ({
    inputMode: 'numeric' as const,
    value,
    placeholder: '0',
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const n = parseAmount(e.target.value)
      set(n ? formatNumber(n) : '')
      setError('')
    },
  })

  function save() {
    const principal = parseAmount(principalText)
    // 마이너스통장은 비워 두면 아직 안 쓴 것(0원), 일반 대출은 대출금 전액
    const balance = balanceText ? parseAmount(balanceText) : isOverdraft ? 0 : principal
    const rate = Number(rateText.replace(',', '.'))
    const paymentDay = Math.min(31, Math.max(1, Math.round(Number(paymentDayText) || 1)))
    if (principal <= 0) return setError(isOverdraft ? '한도를 입력해 주세요' : '대출금액을 입력해 주세요')
    if (balance > principal) return setError(isOverdraft ? '사용액이 한도보다 클 수 없어요' : '현재 잔액이 대출금액보다 클 수 없어요')
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) return setError('금리를 확인해 주세요 (예: 3.85)')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(maturityDate)) return setError('만기일을 입력해 주세요')
    if (maturityDate <= startDate) return setError('만기일은 시작일보다 뒤여야 해요')
    actions.saveLoan({
      id: editing?.id ?? newId(),
      name: name.trim() || LOAN_KINDS[kind].label,
      kind,
      lender: lender.trim(),
      principal,
      // 새 대출은 입력한 잔액에서 시작. 수정할 때는 시작 잔액을 그대로 두고 아래에서 조정 기록을 남겨
      // 월별 잔액 그래프의 과거 값이 바뀌지 않게 한다.
      openingBalance: editing ? editing.openingBalance : balance,
      rate,
      repayment: isOverdraft ? 'bullet' : repayment,
      startDate,
      maturityDate,
      paymentDay,
      memo: memo.trim(),
      closed: closed || undefined,
      createdAt: editing?.createdAt ?? Date.now(),
    })
    if (editing && balance !== editingBalance) actions.adjustLoanBalance(editing.id, balance, editingBalance, todayKey())
    onClose()
  }

  function remove() {
    if (!editing) return
    const msg =
      '이 대출과 원금 상환 기록을 삭제할까요?\n이미 낸 이자는 실제 지출이라 기록 탭에 그대로 남아요.\n(다 갚았다면 삭제 대신 "상환 완료"를 켜면 기록이 보존돼요)'
    if (!window.confirm(msg)) return
    actions.deleteLoan(editing.id)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="대출 정보" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button type="button" className="text-btn" onClick={onClose}>
            취소
          </button>
          <h2>{editing ? '대출 수정' : '대출 추가'}</h2>
          <button type="button" className="text-btn strong" onClick={save}>
            저장
          </button>
        </div>

        <div className="field-label">종류</div>
        <div className="chips">
          {(Object.keys(LOAN_KINDS) as LoanKind[]).map((k) => (
            <button key={k} type="button" className={k === kind ? 'chip on' : 'chip'} onClick={() => setKind(k)}>
              {LOAN_KINDS[k].emoji} {LOAN_KINDS[k].label}
            </button>
          ))}
        </div>

        <div className="two-col">
          <label className="field">
            <span className="field-label">이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={LOAN_KINDS[kind].label} maxLength={20} />
          </label>
          <label className="field">
            <span className="field-label">금융기관</span>
            <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="예: OO은행" maxLength={20} />
          </label>
        </div>

        <div className="two-col">
          <label className="field">
            <span className="field-label">{isOverdraft ? '한도 (원)' : '대출금액 (원)'}</span>
            <input {...amountInput(principalText, setPrincipalText)} />
          </label>
          <label className="field">
            <span className="field-label">{isOverdraft ? '현재 사용액 (원)' : '현재 잔액 (원)'}</span>
            <input {...amountInput(balanceText, setBalanceText)} placeholder={isOverdraft ? '0' : '비우면 대출금액'} />
          </label>
        </div>

        <div className="two-col">
          <label className="field">
            <span className="field-label">연 금리 (%)</span>
            <input
              inputMode="decimal"
              value={rateText}
              placeholder="3.85"
              onChange={(e) => {
                setRateText(e.target.value.replace(/[^0-9.,]/g, ''))
                setError('')
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">매달 납부일</span>
            <input inputMode="numeric" value={paymentDayText} onChange={(e) => setPaymentDayText(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </label>
        </div>

        <div className="two-col">
          <label className="field">
            <span className="field-label">시작일</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{isOverdraft ? '만기(연장)일' : '만기일'}</span>
            <input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
          </label>
        </div>

        {isOverdraft ? (
          <p className="hint">마이너스통장은 쓴 금액에만 이자가 붙어요. 사용액이 바뀌면 납부 기록이나 수정에서 현재 사용액을 고쳐 주세요.</p>
        ) : (
          <>
            <div className="field-label">상환 방식</div>
            <div className="segmented">
              {(Object.keys(REPAYMENT_LABELS) as RepaymentType[]).map((r) => (
                <button key={r} type="button" className={r === repayment ? 'on' : ''} onClick={() => setRepayment(r)}>
                  {REPAYMENT_LABELS[r].replace('상환', '')}
                </button>
              ))}
            </div>
            <p className="hint">{REPAYMENT_HINTS[repayment]}</p>
          </>
        )}

        <label className="field">
          <span className="field-label">메모</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 우대금리 조건, 연장 여부" maxLength={60} />
        </label>

        {editing && (
          <label className="check-row">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
            상환 완료 (목록 아래로 내리고 합계에서 빼요)
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="button" className="primary-btn" onClick={save}>
          {editing ? '수정 완료' : '대출 추가'}
        </button>
        {editing && (
          <button type="button" className="danger-btn" onClick={remove}>
            삭제
          </button>
        )}
      </div>
    </div>
  )
}
