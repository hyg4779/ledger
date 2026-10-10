import { useRef, useState, type PointerEvent } from 'react'
import { formatCompact, formatWon } from '../lib/format'
import { barPath, niceTicks, useWidth } from './chartUtils'

export interface ColumnSeries {
  name: string
  /** CSS 색 (var(--income) 등) */
  color: string
  /** 음수 막대를 다른 색으로 칠할 때 */
  negativeColor?: string
}

interface Props {
  labels: string[]
  series: ColumnSeries[]
  /** values[groupIndex][seriesIndex] */
  values: number[][]
  height?: number
  /** 툴팁 제목 (기본: 라벨) */
  tooltipTitle?: (index: number) => string
  /** 툴팁 마지막 줄에 덧붙일 내용 */
  tooltipExtra?: (index: number) => string | null
  /** 이미 선택된(툴팁이 뜬) 막대를 한 번 더 눌렀을 때. 마우스는 호버로 선택되므로 한 번 클릭이면 된다. */
  onSelect?: (index: number) => void
  /** 계열을 옆으로 나란히 대신 위로 쌓는다 (양수만). 툴팁에 합계가 붙는다. */
  stacked?: boolean
}

const MARGIN = { top: 12, right: 4, bottom: 22, left: 40 }
const GAP = 2

export function ColumnChart({ labels, series, values, height = 200, tooltipTitle, tooltipExtra, onSelect, stacked }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const activeAtDown = useRef<number | null>(null)

  const flat = stacked ? values.map((g) => g.reduce((a, v) => a + Math.max(0, v), 0)) : values.flat()
  const ticks = niceTicks(Math.min(0, ...flat), Math.max(0, ...flat))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const y = (v: number) => MARGIN.top + ((yMax - v) / (yMax - yMin)) * plotH
  const slot = labels.length ? plotW / labels.length : 0
  const k = stacked ? 1 : series.length
  const barW = Math.max(2, Math.min(24, (slot * 0.72 - GAP * (k - 1)) / k))
  const groupW = barW * k + GAP * (k - 1)
  // 좁은 화면에서 라벨이 겹치지 않게 솎아낸다.
  const labelEvery = Math.max(1, Math.ceil(24 / Math.max(slot, 1)))

  function indexAt(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - MARGIN.left) / slot)
    return i >= 0 && i < labels.length ? i : null
  }

  const tipLeft = active === null ? 0 : MARGIN.left + slot * (active + 0.5)

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={series.map((s) => s.name).join(', ') + ' 막대 그래프'}
          onPointerMove={(e) => setActive(indexAt(e))}
          onPointerDown={(e) => {
            activeAtDown.current = active
            const i = indexAt(e)
            setActive(i)
            if (i !== null && i === activeAtDown.current) onSelect?.(i)
          }}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'axis-base' : 'grid'}
              />
              <text x={MARGIN.left - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                {formatCompact(t)}
              </text>
            </g>
          ))}
          {active !== null && (
            <rect className="hover-band" x={MARGIN.left + slot * active} y={MARGIN.top} width={slot} height={plotH} />
          )}
          {stacked &&
            values.map((group, gi) => {
              const x0 = MARGIN.left + slot * gi + (slot - groupW) / 2
              const topIndex = group.reduce((last, v, i) => (v > 0 ? i : last), -1)
              let base = 0
              return group.map((v, si) => {
                if (v <= 0) return null
                const from = base
                base += v
                // 맨 위 조각만 끝을 둥글리고, 조각 사이는 2px 틈으로 구분한다.
                const yTop = y(base)
                const yBottom = y(from) - (si === 0 || from === 0 ? 0 : GAP)
                const d =
                  si === topIndex
                    ? barPath(x0, barW, yBottom, yTop)
                    : `M${x0},${yBottom}V${yTop}H${x0 + barW}V${yBottom}Z`
                return (
                  <path
                    key={`${gi}-${si}`}
                    d={d}
                    fill={series[si].color}
                    opacity={active === null || active === gi ? 1 : 0.45}
                  />
                )
              })
            })}
          {!stacked && values.map((group, gi) => {
            const x0 = MARGIN.left + slot * gi + (slot - groupW) / 2
            return group.map((v, si) => {
              const s = series[si]
              const fill = v < 0 && s.negativeColor ? s.negativeColor : s.color
              return (
                <path
                  key={`${gi}-${si}`}
                  d={barPath(x0 + si * (barW + GAP), barW, y(0), y(v))}
                  fill={fill}
                  opacity={active === null || active === gi ? 1 : 0.45}
                />
              )
            })
          })}
          {labels.map((l, i) =>
            i % labelEvery === 0 || i === active ? (
              <text
                key={l + i}
                x={MARGIN.left + slot * (i + 0.5)}
                y={height - 6}
                className={i === active ? 'tick tick-active' : 'tick'}
                textAnchor="middle"
              >
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {active !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(tipLeft, 70), width - 70), top: 0 }}
          onClick={() => setActive(null)}
        >
          <div className="tooltip-title">{tooltipTitle ? tooltipTitle(active) : labels[active]}</div>
          {series.map((s, si) => (
            <div className="tooltip-row" key={s.name}>
              <span className="swatch" style={{ background: values[active][si] < 0 && s.negativeColor ? s.negativeColor : s.color }} />
              <span>{s.name}</span>
              <b>{formatWon(values[active][si])}</b>
            </div>
          ))}
          {stacked && series.length > 1 && (
            <div className="tooltip-extra">
              합계 <b>{formatWon(values[active].reduce((a, v) => a + v, 0))}</b>
            </div>
          )}
          {tooltipExtra?.(active) && <div className="tooltip-extra">{tooltipExtra(active)}</div>}
        </div>
      )}
    </div>
  )
}
