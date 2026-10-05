import { useMemo, useState } from 'react'
import { SearchIcon } from '../components/Icons'
import { MonthNav } from '../components/MonthNav'
import { currentMonthKey, dayLabel, monthLabel, shiftMonth, type MonthKey } from '../lib/dates'
import { formatCompact, formatWon } from '../lib/format'
import { inMonth, totals } from '../lib/stats'
import { useLedger } from '../lib/store'
import type { Transaction, TxType } from '../lib/types'

interface Props {
  month: MonthKey
  onMonthChange: (m: MonthKey) => void
  onEdit: (tx: Transaction) => void
  categoryFilter: string | null
  onClearFilter: () => void
}

type TypeFilter = 'all' | TxType

export function RecordsScreen({ month, onMonthChange, onEdit, categoryFilter, onClearFilter }: Props) {
  const { data } = useLedger()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories])

  const monthTxs = useMemo(() => inMonth(data.transactions, month), [data.transactions, month])
  const sum = totals(monthTxs)

  const visible = useMemo(() => {
    const q = query.trim()
    return monthTxs.filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (!categoryFilter || t.categoryId === categoryFilter) &&
        (!q || t.memo.includes(q) || catMap.get(t.categoryId)?.name.includes(q)),
    )
  }, [monthTxs, typeFilter, categoryFilter, query, catMap])

  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of [...visible].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
      const list = groups.get(t.date) ?? []
      list.push(t)
      groups.set(t.date, list)
    }
    return [...groups.entries()]
  }, [visible])

  const filterCat = categoryFilter ? catMap.get(categoryFilter) : null

  return (
    <div className="screen">
      <div className="page-head">
        <div className="eyebrow">RECORDS</div>
        <h1 className="page-title">수입·지출 기록</h1>
      </div>

      <MonthNav
        label={monthLabel(month)}
        onPrev={() => onMonthChange(shiftMonth(month, -1))}
        onNext={() => onMonthChange(shiftMonth(month, 1))}
        nextDisabled={month === currentMonthKey()}
        onLabelClick={() => onMonthChange(currentMonthKey())}
      />

      <div className="type-cards">
        {(
          [
            ['all', '남은 돈', sum.income - sum.expense],
            ['income', '수입', sum.income],
            ['expense', '지출', sum.expense],
          ] as [TypeFilter, string, number][]
        ).map(([key, label, value]) => (
          <button
            key={key}
            type="button"
            className={typeFilter === key ? `type-card on ${key}` : `type-card ${key}`}
            onClick={() => setTypeFilter(key)}
            aria-pressed={typeFilter === key}
          >
            <span>
              {key !== 'all' && <span className={`dot ${key}`} />}
              {label}
            </span>
            {/* 좁은 칸이라 100만 원 이상은 '340만원'처럼 줄여 쓴다 */}
            <b className={value < 0 ? 'neg' : ''} title={formatWon(value)}>
              {Math.abs(value) >= 1_000_000 ? `${formatCompact(value)}원` : formatWon(value)}
            </b>
          </button>
        ))}
      </div>

      <label className="search-box">
        <SearchIcon />
        <input type="search" placeholder="메모·카테고리 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {filterCat && (
        <button type="button" className="filter-pill" onClick={onClearFilter}>
          {filterCat.emoji} {filterCat.name}만 보는 중 · {formatWon(visible.reduce((a, t) => a + t.amount, 0))} ✕
        </button>
      )}

      {days.length === 0 ? (
        <div className="empty">
          <p>{monthTxs.length ? '조건에 맞는 기록이 없어요' : '이 달에는 아직 기록이 없어요'}</p>
          {!monthTxs.length && <p className="sub">아래 ＋ 기록하기로 추가해 보세요</p>}
        </div>
      ) : (
        days.map(([date, list]) => {
          const day = totals(list)
          return (
            <section key={date} className="day-group">
              <header>
                <span>{dayLabel(date)}</span>
                <span className="day-sum">
                  {day.income > 0 && <span className="income-text">+{formatWon(day.income)}</span>}
                  {day.expense > 0 && <span>-{formatWon(day.expense)}</span>}
                </span>
              </header>
              <ul className="tx-list">
                {list.map((t) => {
                  const cat = catMap.get(t.categoryId)
                  return (
                    <li key={t.id}>
                      <button type="button" className="tx-row" onClick={() => onEdit(t)}>
                        <span className="tx-emoji" aria-hidden>
                          {cat?.emoji ?? '❔'}
                        </span>
                        <span className="tx-text">
                          <span className="tx-memo">{t.memo || cat?.name || '기록'}</span>
                          {t.memo && <span className="tx-cat">{cat?.name}</span>}
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
            </section>
          )
        })
      )}
    </div>
  )
}
