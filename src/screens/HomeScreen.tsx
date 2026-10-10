import { useMemo, useState } from 'react'
import { useWidth } from '../components/chartUtils'
import { Donut } from '../components/Donut'
import { ChevronRight, InfoIcon, SettingsIcon } from '../components/Icons'
import { MonthNav } from '../components/MonthNav'
import { currentMonthKey, daysInMonth, dayLabel, monthLabel, parseMonthKey, shiftMonth, type MonthKey } from '../lib/dates'
import { formatNumber, formatPercent, formatWon } from '../lib/format'
import { buildSampleData } from '../lib/sampleData'
import { netWorthNow } from '../lib/assets'
import { currentBalance, daysToMaturity, expectedPayment, LOAN_KINDS } from '../lib/loans'
import { byCategory, cumulativeDailyExpense, inMonth, savingsRate, totals } from '../lib/stats'
import { actions, useLedger } from '../lib/store'
import type { Transaction } from '../lib/types'

/** 도넛 조각 색 — 고정 순서(검증된 팔레트), 순위가 아니라 자리 번호로 배정 */
const SLICE_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']
const OTHER_KEY = '__other__'

interface Props {
  month: MonthKey
  onMonthChange: (m: MonthKey) => void
  onShowCategory: (categoryId: string) => void
  onOpenRecords: () => void
  onOpenSettings: () => void
  onOpenLoans: () => void
  onOpenAssets: () => void
  onEdit: (tx: Transaction) => void
}

export function HomeScreen({ month, onMonthChange, onShowCategory, onOpenRecords, onOpenSettings, onOpenLoans, onOpenAssets, onEdit }: Props) {
  const { data } = useLedger()
  const [activeSlice, setActiveSlice] = useState<string | null>(null)
  const [donutRef, donutWidth] = useWidth<HTMLDivElement>()
  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories])

  const txs = useMemo(() => inMonth(data.transactions, month), [data.transactions, month])
  const sum = totals(txs)
  const isCurrent = month === currentMonthKey()
  const { month: m } = parseMonthKey(month)

  // 상위 5개 카테고리 + 나머지는 '기타'로 묶는다(색이 6개를 넘지 않게).
  const slices = useMemo(() => {
    const ranked = byCategory(txs, 'expense')
    const top = ranked.slice(0, 5).map((r, i) => ({ key: r.categoryId, value: r.total, color: SLICE_COLORS[i] }))
    const rest = ranked.slice(5).reduce((a, r) => a + r.total, 0)
    return rest > 0 ? [...top, { key: OTHER_KEY, value: rest, color: 'var(--c-other)' }] : top
  }, [txs])

  // 지난달 같은 기간 대비
  const prevCum = cumulativeDailyExpense(data.transactions, shiftMonth(month, -1))
  const dayIdx = isCurrent ? new Date().getDate() : daysInMonth(month)
  const prevSame = prevCum[Math.min(dayIdx, prevCum.length) - 1] ?? 0

  const active = activeSlice ? slices.find((s) => s.key === activeSlice) : null
  const sliceName = (key: string) => (key === OTHER_KEY ? '기타' : (catMap.get(key)?.name ?? '삭제된 카테고리'))

  const recent = useMemo(
    () => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 4),
    [data.transactions],
  )

  return (
    <div className="screen">
      <header className="app-header">
        <img src="./pwa-192.png" alt="" className="app-logo" />
        <span className="app-name">자산 가계부</span>
        <button type="button" className="round-btn" aria-label="설정" onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
      </header>

      <div className="hero">
        <h1>알뜰하게, 차곡차곡</h1>
        <p>쓰는 돈과 모이는 돈을 한눈에.</p>
      </div>

      <MonthNav
        label={monthLabel(month)}
        onPrev={() => onMonthChange(shiftMonth(month, -1))}
        onNext={() => onMonthChange(shiftMonth(month, 1))}
        nextDisabled={isCurrent}
        onLabelClick={() => onMonthChange(currentMonthKey())}
      />

      {data.transactions.length === 0 && (
        <div className="notice">
          <span className="notice-badge">START</span>
          <p>아직 기록이 없어요. 아래 ＋ 기록하기로 첫 수입·지출을 남겨 보세요.</p>
          <button
            type="button"
            className="notice-link"
            onClick={() => {
              if (window.confirm('최근 14개월치 예시 내역을 넣어볼까요? 설정 → 전체 삭제로 언제든 지울 수 있어요.'))
                actions.addSample(buildSampleData())
            }}
          >
            예시 데이터로 둘러보기 ↗
          </button>
        </div>
      )}

      <section className="card big">
        <div className="card-top">
          <div>
            <div className="eyebrow">MONTHLY OVERVIEW</div>
            <h2 className="card-title">이번 달 지출 대시보드</h2>
          </div>
          <span className="tag">
            {m}월 기록 {txs.length}건
          </span>
        </div>

        <div className="donut-wrap" ref={donutRef}>
          {donutWidth > 0 && (
            <Donut
              size={Math.min(290, donutWidth)}
              slices={slices.length ? slices : []}
              activeKey={activeSlice}
              onSelect={setActiveSlice}
              center={
                active ? (
                  <>
                    <span className="donut-label">{sliceName(active.key)}</span>
                    <strong className="donut-value">
                      {formatNumber(active.value)}
                      <small>원</small>
                    </strong>
                    <span className="donut-sub">지출의 {formatPercent(active.value / sum.expense)}</span>
                  </>
                ) : (
                  <>
                    <span className="donut-label">이번 달 총지출</span>
                    <strong className="donut-value">
                      {formatNumber(sum.expense)}
                      <small>원</small>
                    </strong>
                    {prevSame > 0 ? (
                      <span className={sum.expense <= prevSame ? 'donut-sub good' : 'donut-sub bad'}>
                        지난달 같은 기간보다
                        <br />
                        {sum.expense <= prevSame ? '▼' : '▲'} {formatWon(Math.abs(sum.expense - prevSame))}
                      </span>
                    ) : (
                      <span className="donut-sub">기록한 지출 합계</span>
                    )}
                  </>
                )
              }
            />
          )}
        </div>

        {slices.length > 0 ? (
          <ul className="legend-list">
            {slices.map((s) => {
              const cat = catMap.get(s.key)
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    className={activeSlice === s.key ? 'legend-row on' : 'legend-row'}
                    onClick={() => (s.key === OTHER_KEY ? setActiveSlice(activeSlice === s.key ? null : s.key) : onShowCategory(s.key))}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setActiveSlice(s.key)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && setActiveSlice(null)}
                  >
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="legend-name" title={cat?.emoji}>
                      {sliceName(s.key)}
                    </span>
                    <span className="legend-amt">{formatWon(s.value)}</span>
                    <span className="legend-pct">{formatPercent(s.value / sum.expense)}</span>
                    {s.key !== OTHER_KEY && <ChevronRight />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty-small center">이번 달 지출 기록이 없어요</p>
        )}
        {slices.some((s) => s.key === OTHER_KEY) && (
          <p className="foot-note">
            <InfoIcon /> 상위 5개 카테고리 외에는 기타로 묶었어요. 분석 탭에서 전체를 볼 수 있어요.
          </p>
        )}
      </section>

      <BudgetCard spent={sum.expense} budget={data.monthlyBudget} month={month} onSetBudget={onOpenSettings} />

      <NetWorthCard onOpenAssets={onOpenAssets} onOpenLoans={onOpenLoans} />

      <section className="card">
        <div className="eyebrow">CASH FLOW</div>
        <h2 className="card-title">수입과 저축</h2>
        <div className="flow-grid">
          <div>
            <span className="label">
              <span className="dot income" /> 수입
            </span>
            <b>{formatWon(sum.income)}</b>
          </div>
          <div>
            <span className="label">
              <span className="dot expense" /> 지출
            </span>
            <b>{formatWon(sum.expense)}</b>
          </div>
          <div>
            <span className="label">저축 (수입 − 지출)</span>
            <b className={sum.income - sum.expense < 0 ? 'neg' : ''}>{formatWon(sum.income - sum.expense)}</b>
          </div>
          <div>
            <span className="label">저축률</span>
            <b>{formatPercent(savingsRate(sum))}</b>
          </div>
        </div>
        {sum.income > 0 && (
          <div className="flow-bar" aria-label="수입 대비 지출 비율">
            <div className="flow-bar-fill" style={{ width: `${Math.min(1, sum.expense / sum.income) * 100}%` }} />
          </div>
        )}
        {sum.income > 0 && (
          <p className="flow-caption">
            수입의 {formatPercent(Math.min(1, sum.expense / sum.income))}를 썼어요
            {sum.expense > sum.income && ' — 수입보다 많이 썼어요'}
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-top">
          <div>
            <div className="eyebrow">RECENT</div>
            <h2 className="card-title">최근 기록</h2>
          </div>
          <button type="button" className="tag link" onClick={onOpenRecords}>
            전체 보기 ›
          </button>
        </div>
        {recent.length ? (
          <ul className="tx-list flat">
            {recent.map((t) => {
              const cat = catMap.get(t.categoryId)
              return (
                <li key={t.id}>
                  <button type="button" className="tx-row" onClick={() => onEdit(t)}>
                    <span className="tx-emoji" aria-hidden>
                      {cat?.emoji ?? '❔'}
                    </span>
                    <span className="tx-text">
                      <span className="tx-memo">{t.memo || cat?.name}</span>
                      <span className="tx-cat">
                        {dayLabel(t.date)} · {cat?.name}
                      </span>
                    </span>
                    <span className={t.type === 'income' ? 'tx-amt income-text' : 'tx-amt'}>
                      {t.type === 'income' ? '+' : '-'}
                      {formatWon(t.amount)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty-small">아직 기록이 없어요</p>
        )}
      </section>
    </div>
  )
}

function BudgetCard({ spent, budget, month, onSetBudget }: { spent: number; budget?: number; month: MonthKey; onSetBudget: () => void }) {
  const isCurrent = month === currentMonthKey()
  if (!budget) {
    return (
      <section className="card lime">
        <span className="lime-label">이번 달 남은 생활비</span>
        <p className="lime-empty">월 예산을 정하면 남은 생활비와 하루에 써도 되는 금액을 알려드려요.</p>
        <button type="button" className="lime-btn" onClick={onSetBudget}>
          예산 정하기
        </button>
      </section>
    )
  }
  const remaining = budget - spent
  const ratio = spent / budget
  const today = new Date()
  const daysLeft = isCurrent ? daysInMonth(month) - today.getDate() + 1 : 0
  const elapsed = isCurrent ? today.getDate() / daysInMonth(month) : null

  return (
    <section className="card lime">
      <span className="lime-label">{isCurrent ? '이번 달 남은 생활비' : `${parseMonthKey(month).month}월 남은 생활비`}</span>
      <strong className={remaining < 0 ? 'lime-big neg' : 'lime-big'}>
        {remaining < 0 ? `-${formatWon(-remaining)}` : formatWon(remaining)}
      </strong>
      <span className="lime-sub">
        지출 {formatWon(spent)} / 예산 {formatWon(budget)}
      </span>
      <hr />
      <div className="lime-row">
        <span>예산 사용률</span>
        <b>{formatPercent(ratio)}</b>
      </div>
      <div className="lime-track">
        <div className={ratio > 1 ? 'lime-fill over' : 'lime-fill'} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
        {elapsed !== null && <div className="lime-today" style={{ left: `${elapsed * 100}%` }} />}
      </div>
      {elapsed !== null && <span className="lime-hint">│ 오늘 위치 ({formatPercent(elapsed)} 지남)</span>}
      {isCurrent && (
        <div className="lime-row last">
          <span>오늘 포함 하루 사용 가능</span>
          <b className={remaining < 0 ? 'neg' : ''}>{remaining > 0 ? formatWon(remaining / daysLeft) : '0원'}</b>
        </div>
      )}
    </section>
  )
}

/** 홈의 순자산 요약 — 총자산, 대출, 순자산과 가장 가까운 대출 만기 */
function NetWorthCard({ onOpenAssets, onOpenLoans }: { onOpenAssets: () => void; onOpenLoans: () => void }) {
  const { data } = useLedger()
  const loans = data.loans.filter((l) => !l.closed)
  const hasAssets = data.assets.some((a) => !a.closed)
  if (!loans.length && !hasAssets) return null
  const { assets, debts, net } = netWorthNow(data)
  const nearest = loans
    .map((loan) => ({ loan, days: daysToMaturity(loan) }))
    .filter((r) => r.days >= 0)
    .sort((a, b) => a.days - b.days)[0]
  const interest = loans.reduce((a, l) => a + expectedPayment(l, currentBalance(l, data.loanPayments)).interest, 0)
  return (
    <section className="card">
      <div className="card-top">
        <div>
          <div className="eyebrow">NET WORTH</div>
          <h2 className="card-title">순자산</h2>
        </div>
        <button type="button" className="tag link" onClick={onOpenAssets}>
          자산 ›
        </button>
      </div>
      <strong className={net < 0 ? 'net-big neg' : 'net-big'}>{formatWon(net)}</strong>
      <div className="flow-grid" style={{ marginTop: 12 }}>
        <button type="button" className="flow-cell" onClick={onOpenAssets}>
          <span className="label">총자산</span>
          <b>{formatWon(assets)}</b>
        </button>
        <button type="button" className="flow-cell" onClick={onOpenLoans}>
          <span className="label">대출 · 이달 예상 이자 {formatWon(interest)}</span>
          <b>−{formatWon(debts)}</b>
        </button>
      </div>
      {nearest && (
        <p className={nearest.days <= 365 ? 'flow-caption warn' : 'flow-caption'}>
          {nearest.days <= 365 ? '⚠️ ' : ''}가장 가까운 만기: {LOAN_KINDS[nearest.loan.kind].emoji} {nearest.loan.name} ·{' '}
          {nearest.loan.maturityDate.replace(/-/g, '.')} (D-{nearest.days})
        </p>
      )}
    </section>
  )
}
