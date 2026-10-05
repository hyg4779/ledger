import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useLedger } from '../lib/store'
import { formatNumber, parseAmount } from '../lib/format'
import { LOAN_INTEREST_CATEGORY } from '../lib/loans'
import type { Transaction, TxType } from '../lib/types'

interface Props {
  /** 수정할 내역. null이면 새로 입력 */
  editing: Transaction | null
  defaultDate: string
  onClose: () => void
}

const QUICK_AMOUNTS = [1_000, 10_000, 50_000, 100_000]

export function TransactionSheet({ editing, defaultDate, onClose }: Props) {
  const { data } = useLedger()
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense')
  const [amountText, setAmountText] = useState(editing ? formatNumber(editing.amount) : '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [loanId, setLoanId] = useState(editing?.loanId ?? '')
  const [error, setError] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) amountRef.current?.focus()
  }, [editing])

  const categories = data.categories.filter((c) => c.type === type && (!c.hidden || c.id === categoryId))
  const amount = parseAmount(amountText)

  // 선택한 카테고리에서 최근에 쓴 메모 — 반복 입력을 한 번 탭으로
  const recentMemos = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    const sorted = data.transactions
      .filter((t) => t.categoryId === categoryId && t.memo)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    for (const t of sorted) {
      if (seen.has(t.memo)) continue
      seen.add(t.memo)
      list.push(t.memo)
      if (list.length >= 6) break
    }
    return list
  }, [data.transactions, categoryId])

  function switchType(next: TxType) {
    if (next === type) return
    setType(next)
    setCategoryId('')
  }

  function save() {
    if (amount <= 0) return setError('금액을 입력해 주세요')
    if (!categoryId) return setError('카테고리를 골라 주세요')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('날짜를 확인해 주세요')
    actions.saveTransaction({
      id: editing?.id,
      type,
      amount,
      categoryId,
      date,
      memo: memo.trim(),
      loanId: categoryId === LOAN_INTEREST_CATEGORY && loanId ? loanId : undefined,
    })
    onClose()
  }

  function remove() {
    if (!editing) return
    if (!window.confirm('이 기록을 삭제할까요?')) return
    actions.deleteTransaction(editing.id)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="내역 입력" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button type="button" className="text-btn" onClick={onClose}>
            취소
          </button>
          <h2>{editing ? '기록 수정' : '기록하기'}</h2>
          <button type="button" className="text-btn strong" onClick={save}>
            저장
          </button>
        </div>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={type === 'expense'} className={type === 'expense' ? 'on expense' : ''} onClick={() => switchType('expense')}>
            지출
          </button>
          <button type="button" role="tab" aria-selected={type === 'income'} className={type === 'income' ? 'on income' : ''} onClick={() => switchType('income')}>
            수입
          </button>
        </div>

        <label className="amount-field">
          <input
            ref={amountRef}
            inputMode="numeric"
            placeholder="0"
            value={amountText}
            onChange={(e) => {
              const n = parseAmount(e.target.value)
              setAmountText(n ? formatNumber(n) : '')
              setError('')
            }}
            aria-label="금액"
          />
          <span>원</span>
        </label>
        <div className="chips">
          {QUICK_AMOUNTS.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => setAmountText(formatNumber(amount + q))}>
              +{q >= 10_000 ? `${q / 10_000}만` : `${q / 1_000}천`}
            </button>
          ))}
          <button type="button" className="chip ghost" onClick={() => setAmountText('')}>
            지우기
          </button>
        </div>

        <div className="field-label">카테고리</div>
        <div className="cat-grid">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === categoryId ? `cat-cell on ${type}` : 'cat-cell'}
              onClick={() => {
                setCategoryId(c.id)
                setError('')
              }}
            >
              <span className="cat-emoji" aria-hidden>
                {c.emoji}
              </span>
              <span className="cat-name">{c.name}</span>
            </button>
          ))}
        </div>

        {categoryId === LOAN_INTEREST_CATEGORY && data.loans.length > 0 && (
          <label className="field">
            <span className="field-label">어느 대출의 이자인가요?</span>
            <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
              <option value="">지정 안 함</option>
              {data.loans
                .filter((l) => !l.closed || l.id === loanId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        <div className="row-fields">
          <label className="field">
            <span className="field-label">날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">메모</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 점심, 마트" maxLength={60} />
        </label>
        {recentMemos.length > 0 && (
          <div className="chips">
            {recentMemos.map((m) => (
              <button key={m} type="button" className="chip ghost" onClick={() => setMemo(m)}>
                {m}
              </button>
            ))}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="button" className={`primary-btn ${type}`} onClick={save}>
          {editing ? '수정 완료' : '저장'}
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
