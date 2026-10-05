import type { Category } from '../lib/types'
import { formatCompact, formatWon } from '../lib/format'

interface Props {
  rows: { categoryId: string; months: number[]; total: number }[]
  categories: Map<string, Category>
  /** 칸 색의 기준 색 — 진할수록 금액이 크다 */
  color: string
}

/** 카테고리 × 월 지출 표. 셀 배경은 같은 색의 농도로 금액 크기를 나타낸다. */
export function CategoryHeatmap({ rows, categories, color }: Props) {
  if (!rows.length) return <p className="empty-small">내역이 없어요</p>
  const max = Math.max(...rows.flatMap((r) => r.months))
  const monthTotals = Array.from({ length: 12 }, (_, m) => rows.reduce((a, r) => a + r.months[m], 0))

  return (
    <div className="heatmap-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th className="sticky-col">카테고리</th>
            {monthTotals.map((_, m) => (
              <th key={m}>{m + 1}월</th>
            ))}
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cat = categories.get(r.categoryId)
            return (
              <tr key={r.categoryId}>
                <th className="sticky-col">
                  {cat?.emoji} {cat?.name ?? '삭제됨'}
                </th>
                {r.months.map((v, m) => {
                  // 0~100% 농도. 0원은 빈 칸으로 둔다.
                  const pct = v > 0 ? 12 + Math.round((v / max) * 78) : 0
                  return (
                    <td
                      key={m}
                      title={`${cat?.name} ${m + 1}월 ${formatWon(v)}`}
                      style={pct ? { background: `color-mix(in oklab, ${color} ${pct}%, var(--surface))` } : undefined}
                      className={pct > 55 ? 'on-strong' : undefined}
                    >
                      {v ? formatCompact(v) : ''}
                    </td>
                  )
                })}
                <td className="total">{formatCompact(r.total)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th className="sticky-col">합계</th>
            {monthTotals.map((v, m) => (
              <td key={m}>{v ? formatCompact(v) : ''}</td>
            ))}
            <td className="total">{formatCompact(monthTotals.reduce((a, b) => a + b, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
