import { useMemo, useState } from 'react'
import { CategoryBars } from '../components/CategoryBars'
import { CategoryHeatmap } from '../components/CategoryHeatmap'
import { ColumnChart } from '../components/ColumnChart'
import { LineChart } from '../components/LineChart'
import { MonthNav } from '../components/MonthNav'
import { currentMonthKey, monthKeyOf, monthLabel, parseMonthKey, shiftMonth, todayKey, type MonthKey } from '../lib/dates'
import { formatPercent, formatWon } from '../lib/format'
import {
  byCategory,
  categoryMonthMatrix,
  cumulativeDailyExpense,
  inMonth,
  inYear,
  monthlyTotals,
  savingsRate,
  totals,
  yearlyTotals,
  type Totals,
} from '../lib/stats'
import { useLedger } from '../lib/store'
import type { Category } from '../lib/types'

type View = 'month' | 'year' | 'all'

interface Props {
  month: MonthKey
  onMonthChange: (m: MonthKey) => void
  /** 카테고리를 누르면 내역 탭에서 해당 카테고리만 보여준다 */
  onShowCategory: (categoryId: string, month: MonthKey) => void
}

export function StatsScreen({ month, onMonthChange, onShowCategory }: Props) {
  const [view, setView] = useState<View>('month')
  const { data } = useLedger()
  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories])

  return (
    <div className="screen">
      <div className="page-head">
        <div className="eyebrow">ANALYSIS</div>
        <h1 className="page-title">분석</h1>
      </div>
      <div className="segmented top">
        {(
          [
            ['month', '월간'],
            ['year', '연간'],
            ['all', '전체'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'month' && <MonthView month={month} onMonthChange={onMonthChange} catMap={catMap} onShowCategory={onShowCategory} />}
      {view === 'year' && (
        <YearView
          year={parseMonthKey(month).year}
          onYearChange={(y) => onMonthChange(monthKeyOf(y, y === new Date().getFullYear() ? new Date().getMonth() + 1 : 12))}
          catMap={catMap}
          onPickMonth={(m) => {
            onMonthChange(m)
            setView('month')
          }}
        />
      )}
      {view === 'all' && (
        <AllView
          onPickYear={(y) => {
            onMonthChange(monthKeyOf(y, y === new Date().getFullYear() ? new Date().getMonth() + 1 : 12))
            setView('year')
          }}
        />
      )}
    </div>
  )
}

/* ───────────── 공통 ───────────── */

function KpiGrid({ t, extra }: { t: Totals; extra?: { label: string; value: string } }) {
  const net = t.income - t.expense
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <span className="label">
          <span className="dot income" /> 수입
        </span>
        <b>{formatWon(t.income)}</b>
      </div>
      <div className="kpi">
        <span className="label">
          <span className="dot expense" /> 지출
        </span>
        <b>{formatWon(t.expense)}</b>
      </div>
      <div className="kpi">
        <span className="label">저축 (수입 − 지출)</span>
        <b className={net < 0 ? 'neg' : ''}>{formatWon(net)}</b>
      </div>
      <div className="kpi">
        <span className="label">저축률</span>
        <b>{formatPercent(savingsRate(t))}</b>
      </div>
      {extra && (
        <div className="kpi wide">
          <span className="label">{extra.label}</span>
          <b>{extra.value}</b>
        </div>
      )}
    </div>
  )
}

/** 지난 기간 대비 변화. 지출은 줄면 좋은 것이므로 색 의미를 뒤집는다. */
function Delta({ now, before, label, goodWhenDown }: { now: number; before: number; label: string; goodWhenDown?: boolean }) {
  if (before <= 0) return null
  const diff = now - before
  const ratio = diff / before
  const good = goodWhenDown ? diff <= 0 : diff >= 0
  return (
    <p className={good ? 'delta good' : 'delta bad'}>
      {diff >= 0 ? '▲' : '▼'} {label} {formatWon(Math.abs(diff))} {diff >= 0 ? '많아요' : '적어요'} ({formatPercent(Math.abs(ratio))})
    </p>
  )
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.name}>
          <span className="swatch" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  )
}

/* ───────────── 월간 ───────────── */

function MonthView({
  month,
  onMonthChange,
  catMap,
  onShowCategory,
}: {
  month: MonthKey
  onMonthChange: (m: MonthKey) => void
  catMap: Map<string, Category>
  onShowCategory: (categoryId: string, month: MonthKey) => void
}) {
  const { data } = useLedger()
  const txs = useMemo(() => inMonth(data.transactions, month), [data.transactions, month])
  const prevMonth = shiftMonth(month, -1)
  const prevTxs = useMemo(() => inMonth(data.transactions, prevMonth), [data.transactions, prevMonth])
  const t = totals(txs)
  const prev = totals(prevTxs)
  const isCurrent = month === currentMonthKey()

  const thisCum = cumulativeDailyExpense(data.transactions, month)
  // 진행 중인 달은 오늘까지만 그린다.
  const thisLine = isCurrent ? thisCum.slice(0, new Date().getDate()) : thisCum
  const prevLine = cumulativeDailyExpense(data.transactions, prevMonth)
  const daysElapsed = thisLine.length
  const avgPerDay = daysElapsed ? t.expense / daysElapsed : 0
  // 진행 중인 달은 지난달 전체가 아니라 지난달 같은 날짜까지와 비교해야 공정하다.
  const prevSamePeriod = isCurrent ? (prevLine[Math.min(daysElapsed, prevLine.length) - 1] ?? 0) : prev.expense

  return (
    <>
      <MonthNav
        label={monthLabel(month)}
        onPrev={() => onMonthChange(shiftMonth(month, -1))}
        onNext={() => onMonthChange(shiftMonth(month, 1))}
        nextDisabled={isCurrent}
      />
      <section className="card">
        <KpiGrid t={t} extra={{ label: isCurrent ? '하루 평균 지출 (오늘까지)' : '하루 평균 지출', value: formatWon(avgPerDay) }} />
        <Delta now={t.expense} before={prevSamePeriod} label={isCurrent ? '지출이 지난달 같은 기간보다' : '지출이 지난달보다'} goodWhenDown />
      </section>

      <section className="card">
        <h3>누적 지출 흐름</h3>
        <p className="card-sub">이번 달 지출이 지난달보다 빠른지 비교해요</p>
        <Legend
          items={[
            { name: `${parseMonthKey(month).month}월`, color: 'var(--expense)' },
            { name: `${parseMonthKey(prevMonth).month}월`, color: 'var(--muted-line)' },
          ]}
        />
        <LineChart
          series={[
            { name: `${parseMonthKey(prevMonth).month}월`, color: 'var(--muted-line)', values: prevLine },
            { name: `${parseMonthKey(month).month}월`, color: 'var(--expense)', values: thisLine },
          ]}
          xLabel={(i) => `${i + 1}일`}
        />
      </section>

      <section className="card">
        <h3>지출 카테고리</h3>
        <p className="card-sub">누르면 해당 내역만 볼 수 있어요</p>
        <CategoryBars
          rows={byCategory(txs, 'expense')}
          categories={catMap}
          color="var(--expense)"
          showBudget
          onSelect={(id) => onShowCategory(id, month)}
        />
      </section>

      <section className="card">
        <h3>수입 카테고리</h3>
        <CategoryBars rows={byCategory(txs, 'income')} categories={catMap} color="var(--income)" onSelect={(id) => onShowCategory(id, month)} />
      </section>
    </>
  )
}

/* ───────────── 연간 ───────────── */

function YearView({
  year,
  onYearChange,
  catMap,
  onPickMonth,
}: {
  year: number
  onYearChange: (y: number) => void
  catMap: Map<string, Category>
  onPickMonth: (m: MonthKey) => void
}) {
  const { data } = useLedger()
  const thisYear = new Date().getFullYear()
  const yearTxs = useMemo(() => inYear(data.transactions, year), [data.transactions, year])
  const t = totals(yearTxs)
  // 올해는 작년 같은 날짜까지와 비교한다.
  const isThisYear = year === thisYear
  const cutoff = todayKey().slice(5)
  const prev = totals(inYear(data.transactions, year - 1).filter((tx) => !isThisYear || tx.date.slice(5) <= cutoff))
  const prevLabel = isThisYear ? '작년 같은 기간보다' : '작년보다'
  const months = useMemo(() => monthlyTotals(data.transactions, year), [data.transactions, year])
  const matrix = useMemo(() => categoryMonthMatrix(data.transactions, year, 'expense'), [data.transactions, year])
  // 평균은 지나간 달(올해) 또는 12개월(지난해) 기준
  const monthCount = year === thisYear ? new Date().getMonth() + 1 : 12
  const labels = months.map((_, i) => `${i + 1}`)

  return (
    <>
      <MonthNav label={`${year}년`} onPrev={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} nextDisabled={year >= thisYear} />
      <section className="card">
        <KpiGrid t={t} extra={{ label: `월평균 지출 (${monthCount}개월 기준)`, value: formatWon(t.expense / monthCount) }} />
        <Delta now={t.expense} before={prev.expense} label={`지출이 ${prevLabel}`} goodWhenDown />
        <Delta now={t.income} before={prev.income} label={`수입이 ${prevLabel}`} />
      </section>

      <section className="card">
        <h3>월별 수입·지출</h3>
        <p className="card-sub">막대를 누르면 금액이 보이고, 한 번 더 누르면 그 달 통계로 가요</p>
        <Legend
          items={[
            { name: '수입', color: 'var(--income)' },
            { name: '지출', color: 'var(--expense)' },
          ]}
        />
        <ColumnChart
          labels={labels}
          series={[
            { name: '수입', color: 'var(--income)' },
            { name: '지출', color: 'var(--expense)' },
          ]}
          values={months.map((m) => [m.income, m.expense])}
          tooltipTitle={(i) => `${year}년 ${i + 1}월`}
          tooltipExtra={(i) => {
            const m = months[i]
            return m.income || m.expense ? `저축 ${formatWon(m.income - m.expense)} · 저축률 ${formatPercent(savingsRate(m))}` : null
          }}
          onSelect={(i) => onPickMonth(monthKeyOf(year, i + 1))}
        />
      </section>

      <section className="card">
        <h3>월별 저축액</h3>
        <p className="card-sub">수입 − 지출. 아래로 내려간 달은 적자예요</p>
        <ColumnChart
          labels={labels}
          series={[{ name: '저축', color: 'var(--income)', negativeColor: 'var(--expense)' }]}
          values={months.map((m) => [m.income - m.expense])}
          height={170}
          tooltipTitle={(i) => `${year}년 ${i + 1}월`}
          tooltipExtra={(i) => (months[i].income ? `저축률 ${formatPercent(savingsRate(months[i]))}` : null)}
        />
      </section>

      <section className="card">
        <h3>월별 요약표</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>월</th>
                <th>수입</th>
                <th>지출</th>
                <th>저축</th>
                <th>저축률</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i} onClick={() => onPickMonth(monthKeyOf(year, i + 1))} className={m.income || m.expense ? 'clickable' : 'dim'}>
                  <th>{i + 1}월</th>
                  {m.income || m.expense ? (
                    <>
                      <td>{formatWon(m.income)}</td>
                      <td>{formatWon(m.expense)}</td>
                      <td className={m.income - m.expense < 0 ? 'neg' : ''}>{formatWon(m.income - m.expense)}</td>
                      <td>{formatPercent(savingsRate(m))}</td>
                    </>
                  ) : (
                    <td colSpan={4}>-</td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>합계</th>
                <td>{formatWon(t.income)}</td>
                <td>{formatWon(t.expense)}</td>
                <td className={t.income - t.expense < 0 ? 'neg' : ''}>{formatWon(t.income - t.expense)}</td>
                <td>{formatPercent(savingsRate(t))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>카테고리별 월 지출</h3>
        <p className="card-sub">색이 진할수록 많이 쓴 달이에요 (단위: 원, 만=1만 원)</p>
        <CategoryHeatmap rows={matrix} categories={catMap} color="var(--expense)" />
      </section>

      <section className="card">
        <h3>연간 지출 카테고리</h3>
        <CategoryBars rows={byCategory(yearTxs, 'expense')} categories={catMap} color="var(--expense)" />
      </section>
    </>
  )
}

/* ───────────── 전체 ───────────── */

function AllView({ onPickYear }: { onPickYear: (y: number) => void }) {
  const { data } = useLedger()
  const years = useMemo(() => yearlyTotals(data.transactions), [data.transactions])
  const all = totals(data.transactions)

  // 월 단위 누적 순저축 — 자산이 어떻게 쌓여 왔는지
  const cumulative = useMemo(() => {
    if (!data.transactions.length) return { labels: [] as string[], values: [] as number[] }
    const byMonth = new Map<string, number>()
    for (const t of data.transactions) {
      const k = t.date.slice(0, 7)
      byMonth.set(k, (byMonth.get(k) ?? 0) + (t.type === 'income' ? t.amount : -t.amount))
    }
    const keys = [...byMonth.keys()].sort()
    const labels: string[] = []
    const values: number[] = []
    let acc = 0
    for (let k = keys[0]; k <= keys[keys.length - 1]; k = shiftMonth(k, 1)) {
      acc += byMonth.get(k) ?? 0
      labels.push(k)
      values.push(acc)
    }
    return { labels, values }
  }, [data.transactions])

  if (!data.transactions.length) {
    return <div className="empty">아직 내역이 없어요</div>
  }

  const n = cumulative.labels.length
  const shortLabel = (k: string) => {
    const { year, month } = parseMonthKey(k)
    return `${String(year).slice(2)}.${month}`
  }

  return (
    <>
      <section className="card">
        <KpiGrid t={all} extra={{ label: '기록 기간', value: `${n}개월 (${cumulative.labels[0]} ~ ${cumulative.labels[n - 1]})` }} />
      </section>

      <section className="card">
        <h3>누적 저축 추이</h3>
        <p className="card-sub">가계부를 쓰기 시작한 뒤 쌓인 순저축 (수입 − 지출)</p>
        <LineChart
          series={[{ name: '누적 저축', color: 'var(--income)', values: cumulative.values }]}
          xLabel={(i) => shortLabel(cumulative.labels[i])}
          tooltipTitle={(i) => `${monthLabel(cumulative.labels[i])}까지`}
          xTicks={[0, Math.floor((n - 1) / 2), n - 1]}
        />
      </section>

      <section className="card">
        <h3>연도별 수입·지출</h3>
        <Legend
          items={[
            { name: '수입', color: 'var(--income)' },
            { name: '지출', color: 'var(--expense)' },
          ]}
        />
        <ColumnChart
          labels={years.map((y) => `${y.year}`)}
          series={[
            { name: '수입', color: 'var(--income)' },
            { name: '지출', color: 'var(--expense)' },
          ]}
          values={years.map((y) => [y.totals.income, y.totals.expense])}
          tooltipTitle={(i) => `${years[i].year}년`}
          tooltipExtra={(i) => `저축 ${formatWon(years[i].totals.income - years[i].totals.expense)}`}
        />
      </section>

      <section className="card">
        <h3>연도별 요약표</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>연도</th>
                <th>수입</th>
                <th>지출</th>
                <th>저축</th>
                <th>저축률</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="clickable" onClick={() => onPickYear(y.year)}>
                  <th>{y.year}</th>
                  <td>{formatWon(y.totals.income)}</td>
                  <td>{formatWon(y.totals.expense)}</td>
                  <td className={y.totals.income - y.totals.expense < 0 ? 'neg' : ''}>{formatWon(y.totals.income - y.totals.expense)}</td>
                  <td>{formatPercent(savingsRate(y.totals))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
