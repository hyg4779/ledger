import { useMemo } from 'react'
import { useWidth } from '../components/chartUtils'
import { ColumnChart } from '../components/ColumnChart'
import { Donut } from '../components/Donut'
import { InfoIcon } from '../components/Icons'
import { MonthNav } from '../components/MonthNav'
import { currentMonthKey, monthLabel, parseMonthKey, shiftMonth, type MonthKey } from '../lib/dates'
import { formatNumber, formatPercent, formatWon } from '../lib/format'
import {
  currentBalance,
  daysToMaturity,
  expectedPayment,
  interestByLoan,
  LOAN_INTEREST_CATEGORY,
  LOAN_KINDS,
  REPAYMENT_LABELS,
  weightedRate,
} from '../lib/loans'
import { inMonth, inYear } from '../lib/stats'
import { useLedger } from '../lib/store'
import type { Loan } from '../lib/types'

const SLICE_COLORS = ['var(--c1)', 'var(--c3)', 'var(--c2)', 'var(--c5)', 'var(--c4)']

interface Props {
  month: MonthKey
  onMonthChange: (m: MonthKey) => void
  onAddLoan: () => void
  onEditLoan: (loan: Loan) => void
  onPay: (loan: Loan) => void
}

export function LoansScreen({ month, onMonthChange, onAddLoan, onEditLoan, onPay }: Props) {
  const { data } = useLedger()
  const [donutRef, donutWidth] = useWidth<HTMLDivElement>()

  const rows = useMemo(
    () =>
      data.loans
        .filter((l) => !l.closed)
        .map((loan) => {
          const balance = currentBalance(loan, data.loanPayments)
          return { loan, balance, expected: expectedPayment(loan, balance) }
        })
        .sort((a, b) => b.balance - a.balance),
    [data.loans, data.loanPayments],
  )
  const closedLoans = data.loans.filter((l) => l.closed)

  const totalBalance = rows.reduce((a, r) => a + r.balance, 0)
  const totalPrincipal = rows.reduce((a, r) => a + r.loan.principal, 0)
  const expInterest = rows.reduce((a, r) => a + r.expected.interest, 0)
  const expPrincipal = rows.reduce((a, r) => a + r.expected.principal, 0)
  const avgRate = weightedRate(rows)

  const monthTxs = useMemo(() => inMonth(data.transactions, month), [data.transactions, month])
  const paidByLoan = interestByLoan(monthTxs)
  const paidThisMonth = [...paidByLoan.values()].reduce((a, b) => a + b, 0)
  const unlinked = paidByLoan.get('') ?? 0
  const paidLoanIds = new Set(data.loanPayments.filter((p) => p.date.startsWith(month)).map((p) => p.loanId))

  const { year, month: m } = parseMonthKey(month)
  const yearlyInterest = useMemo(() => {
    const months = Array(12).fill(0)
    for (const t of inYear(data.transactions, year)) {
      if (t.type === 'expense' && t.categoryId === LOAN_INTEREST_CATEGORY) months[Number(t.date.slice(5, 7)) - 1] += t.amount
    }
    return months as number[]
  }, [data.transactions, year])
  const yearTotal = yearlyInterest.reduce((a, b) => a + b, 0)

  const slices = rows.slice(0, 5).map((r, i) => ({ key: r.loan.id, value: r.balance, color: SLICE_COLORS[i] }))
  const restBalance = rows.slice(5).reduce((a, r) => a + r.balance, 0)
  if (restBalance > 0) slices.push({ key: '__other__', value: restBalance, color: 'var(--c-other)' })

  return (
    <div className="screen">
      <div className="page-head">
        <div className="eyebrow">LOANS</div>
        <h1 className="page-title">대출·이자</h1>
        <p className="page-sub">빌린 돈의 잔액과 매달 드는 비용을 한눈에.</p>
      </div>

      {rows.length === 0 ? (
        <section className="card">
          <h2 className="card-title">등록된 대출이 없어요</h2>
          <p className="card-sub" style={{ marginTop: 8 }}>
            전세대출·주택담보대출·신용대출을 등록하면 남은 잔액, 이번 달 예상 이자, 만기까지 남은 기간을 알려드려요. 납부를 기록하면 이자는 지출로 함께
            집계돼요.
          </p>
          <button type="button" className="primary-btn" onClick={onAddLoan}>
            ＋ 대출 추가
          </button>
        </section>
      ) : (
        <>
          <section className="card lime">
            <span className="lime-label">총 대출 잔액</span>
            <strong className="lime-big">{formatWon(totalBalance)}</strong>
            <span className="lime-sub">
              대출 {rows.length}건 · 평균 금리 연 {Number.isFinite(avgRate) ? avgRate.toFixed(2) : '-'}%
            </span>
            <hr />
            <div className="lime-row">
              <span>갚은 원금</span>
              <b>{formatPercent((totalPrincipal - totalBalance) / totalPrincipal)}</b>
            </div>
            <div className="lime-track">
              <div className="lime-fill" style={{ width: `${Math.min(1, (totalPrincipal - totalBalance) / totalPrincipal) * 100}%` }} />
            </div>
            <div className="lime-row last">
              <span>이번 달 예상 이자</span>
              <b>{formatWon(expInterest)}</b>
            </div>
            <div className="lime-row" style={{ marginTop: 8 }}>
              <span>이번 달 예상 원금 상환</span>
              <b>{formatWon(expPrincipal)}</b>
            </div>
          </section>

          {rows.length > 1 && (
            <section className="card big">
              <div className="eyebrow">BALANCE MIX</div>
              <h2 className="card-title">대출 잔액 구성</h2>
              <div className="donut-wrap" ref={donutRef}>
                {donutWidth > 0 && (
                  <Donut
                    size={Math.min(250, donutWidth)}
                    slices={slices}
                    center={
                      <>
                        <span className="donut-label">총 잔액</span>
                        <strong className="donut-value small">
                          {formatNumber(totalBalance / 10_000)}
                          <small>만원</small>
                        </strong>
                      </>
                    }
                  />
                )}
              </div>
              <ul className="legend-list">
                {slices.map((s) => {
                  const loan = rows.find((r) => r.loan.id === s.key)?.loan
                  return (
                    <li key={s.key}>
                      <div className="legend-row">
                        <span className="legend-dot" style={{ background: s.color }} />
                        <span className="legend-name">{loan?.name ?? '기타'}</span>
                        <span className="legend-amt">{formatWon(s.value)}</span>
                        <span className="legend-pct">{formatPercent(s.value / totalBalance)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {(rows.length > 0 || paidThisMonth > 0) && (
        <section className="card">
          <div className="card-top">
            <div>
              <div className="eyebrow">MONTHLY INTEREST</div>
              <h2 className="card-title">{m}월 납부 이자</h2>
            </div>
            <span className="tag">{formatWon(paidThisMonth)}</span>
          </div>
          <MonthNav
            label={monthLabel(month)}
            onPrev={() => onMonthChange(shiftMonth(month, -1))}
            onNext={() => onMonthChange(shiftMonth(month, 1))}
            nextDisabled={month === currentMonthKey()}
          />
          <ul className="interest-list">
            {rows.map(({ loan, expected }) => {
              const paid = paidByLoan.get(loan.id) ?? 0
              const done = paidLoanIds.has(loan.id) || paid > 0
              return (
                <li key={loan.id}>
                  <span className="tx-emoji" aria-hidden>
                    {LOAN_KINDS[loan.kind].emoji}
                  </span>
                  <span className="tx-text">
                    <span className="tx-memo">{loan.name}</span>
                    <span className="tx-cat">
                      {done ? `✓ 납부 기록됨` : month === currentMonthKey() ? `납부일 ${loan.paymentDay}일 · 예상 ${formatWon(expected.interest)}` : '기록 없음'}
                    </span>
                  </span>
                  {done ? (
                    <b className="tx-amt">{formatWon(paid)}</b>
                  ) : (
                    <button type="button" className="mini-btn" onClick={() => onPay(loan)}>
                      기록
                    </button>
                  )}
                </li>
              )
            })}
            {unlinked > 0 && (
              <li>
                <span className="tx-emoji" aria-hidden>
                  🏦
                </span>
                <span className="tx-text">
                  <span className="tx-memo">대출 지정 안 한 이자</span>
                  <span className="tx-cat">기록 탭에서 대출을 지정할 수 있어요</span>
                </span>
                <b className="tx-amt">{formatWon(unlinked)}</b>
              </li>
            )}
          </ul>
        </section>
      )}

      {yearTotal > 0 && (
        <section className="card">
          <div className="eyebrow">YEARLY</div>
          <h2 className="card-title">{year}년 월별 이자</h2>
          <p className="card-sub" style={{ marginTop: 6 }}>
            올해 낸 이자 합계 {formatWon(yearTotal)}
          </p>
          <ColumnChart
            labels={yearlyInterest.map((_, i) => `${i + 1}`)}
            series={[{ name: '납부 이자', color: 'var(--c1)' }]}
            values={yearlyInterest.map((v) => [v])}
            height={170}
            tooltipTitle={(i) => `${year}년 ${i + 1}월`}
          />
        </section>
      )}

      {rows.map(({ loan, balance, expected }) => (
        <LoanCard key={loan.id} loan={loan} balance={balance} expected={expected} onEdit={() => onEditLoan(loan)} onPay={() => onPay(loan)} />
      ))}

      {rows.length > 0 && (
        <button type="button" className="secondary-btn" onClick={onAddLoan}>
          ＋ 대출 추가
        </button>
      )}

      {closedLoans.length > 0 && (
        <section className="card">
          <h3>상환 완료</h3>
          <ul className="interest-list">
            {closedLoans.map((loan) => (
              <li key={loan.id}>
                <span className="tx-emoji" aria-hidden>
                  {LOAN_KINDS[loan.kind].emoji}
                </span>
                <span className="tx-text">
                  <span className="tx-memo">{loan.name}</span>
                  <span className="tx-cat">
                    {formatWon(loan.principal)} · 만기 {loan.maturityDate}
                  </span>
                </span>
                <button type="button" className="mini-btn ghost" onClick={() => onEditLoan(loan)}>
                  보기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="foot-note">
        <InfoIcon /> 원금 상환은 빚이 줄어든 것이라 지출에 넣지 않고, 이자만 지출로 집계해요.
      </p>
    </div>
  )
}

function LoanCard({
  loan,
  balance,
  expected,
  onEdit,
  onPay,
}: {
  loan: Loan
  balance: number
  expected: { interest: number; principal: number }
  onEdit: () => void
  onPay: () => void
}) {
  const days = daysToMaturity(loan)
  const repaidRatio = loan.principal ? (loan.principal - balance) / loan.principal : 0
  const months = Math.ceil(days / 30.4)
  // 만기 1년 이내면 연장·상환 계획이 필요하다는 신호를 준다(아이콘+문구로, 색만으로 전달하지 않음).
  const soon = days >= 0 && days <= 365
  const overdue = days < 0
  return (
    <section className="card loan-card">
      <div className="loan-head">
        <span className="tx-emoji" aria-hidden>
          {LOAN_KINDS[loan.kind].emoji}
        </span>
        <div className="loan-title">
          <b>{loan.name}</b>
          <span>
            {[loan.lender, LOAN_KINDS[loan.kind].label, REPAYMENT_LABELS[loan.repayment]].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className={overdue || soon ? 'dday warn' : 'dday'}>{overdue ? '만기 지남' : days === 0 ? '오늘 만기' : `D-${days}`}</span>
      </div>

      <div className="loan-balance">
        <span>남은 잔액</span>
        <strong>{formatWon(balance)}</strong>
      </div>
      <div className="loan-track" aria-label={`원금의 ${formatPercent(repaidRatio)} 상환`}>
        <div className="loan-fill" style={{ width: `${Math.min(1, Math.max(0, repaidRatio)) * 100}%` }} />
      </div>
      <div className="loan-track-caption">
        <span>갚은 원금 {formatPercent(repaidRatio)}</span>
        <span>대출금 {formatWon(loan.principal)}</span>
      </div>

      <dl className="loan-facts">
        <div>
          <dt>연 금리</dt>
          <dd>{loan.rate}%</dd>
        </div>
        <div>
          <dt>이번 달 예상 이자</dt>
          <dd>{formatWon(expected.interest)}</dd>
        </div>
        <div>
          <dt>예상 원금 상환</dt>
          <dd>{formatWon(expected.principal)}</dd>
        </div>
        <div>
          <dt>만기일</dt>
          <dd>
            {loan.maturityDate.replace(/-/g, '.')}
            {!overdue && <small> ({months}개월)</small>}
          </dd>
        </div>
      </dl>

      {(soon || overdue) && (
        <p className="loan-warn">
          ⚠️ {overdue ? '만기가 지났어요. 상환했다면 "상환 완료"로 바꿔 주세요.' : `만기까지 ${months}개월 남았어요. 연장·상환 계획을 미리 확인해 두세요.`}
        </p>
      )}
      {loan.memo && <p className="loan-memo">{loan.memo}</p>}

      <div className="loan-actions">
        <button type="button" className="lime-btn" onClick={onPay}>
          납부 기록
        </button>
        <button type="button" className="secondary-btn small" onClick={onEdit}>
          수정
        </button>
      </div>
    </section>
  )
}
