import type { Category } from '../lib/types'
import { formatPercent, formatWon } from '../lib/format'

interface Props {
  rows: { categoryId: string; total: number }[]
  categories: Map<string, Category>
  color: string
  /** 월 단위 화면에서만 카테고리 예산 대비 사용률을 보여준다 */
  showBudget?: boolean
  onSelect?: (categoryId: string) => void
}

/** 카테고리별 금액 순위 — 막대 길이는 1위 대비, 비율은 전체 합계 대비 */
export function CategoryBars({ rows, categories, color, showBudget, onSelect }: Props) {
  const sum = rows.reduce((a, r) => a + r.total, 0)
  const max = rows[0]?.total ?? 0
  if (!rows.length) return <p className="empty-small">내역이 없어요</p>

  return (
    <ul className="cat-bars">
      {rows.map((r) => {
        const cat = categories.get(r.categoryId)
        const budget = showBudget ? cat?.budget : undefined
        const over = budget ? r.total > budget : false
        return (
          <li key={r.categoryId}>
            <button type="button" className="cat-bar-row" onClick={() => onSelect?.(r.categoryId)}>
              <div className="cat-bar-head">
                <span className="cat-bar-name">
                  <span aria-hidden>{cat?.emoji ?? '❔'}</span> {cat?.name ?? '삭제된 카테고리'}
                </span>
                <span className="cat-bar-pct">{formatPercent(r.total / sum)}</span>
                <span className="cat-bar-amt">{formatWon(r.total)}</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: `${(r.total / max) * 100}%`, background: color }} />
              </div>
              {budget ? (
                <div className={over ? 'cat-bar-budget over' : 'cat-bar-budget'}>
                  {over ? '⚠️ 예산 초과' : '예산'} {formatWon(r.total)} / {formatWon(budget)} ({formatPercent(r.total / budget)})
                </div>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
