import { useState, type PointerEvent } from 'react'
import { formatCompact, formatWon } from '../lib/format'
import { niceTicks, useWidth } from './chartUtils'

export interface LineSeries {
  name: string
  color: string
  /** values[i]는 x = i + 1일째 값 */
  values: number[]
}

interface Props {
  series: LineSeries[]
  height?: number
  xLabel: (i: number) => string
  /** 툴팁 제목 (기본: 'x까지 누적') */
  tooltipTitle?: (i: number) => string
  /** x축에 표시할 인덱스 (기본: 1·10·20·마지막) */
  xTicks?: number[]
}

const MARGIN = { top: 12, right: 12, bottom: 22, left: 40 }

export function LineChart({ series, height = 190, xLabel, tooltipTitle, xTicks: xTicksProp }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const n = Math.max(...series.map((s) => s.values.length), 1)
  const all = series.flatMap((s) => s.values)
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const x = (i: number) => MARGIN.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => MARGIN.top + ((yMax - v) / (yMax - yMin)) * plotH
  const xTicks = (xTicksProp ?? [0, 9, 19, n - 1]).filter((i, idx, arr) => i < n && arr.indexOf(i) === idx)

  function indexAt(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - MARGIN.left) / plotW
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
  }

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={series.map((s) => s.name).join(', ') + ' 꺾은선 그래프'}
          onPointerMove={(e) => setActive(indexAt(e))}
          onPointerDown={(e) => setActive(indexAt(e))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-base' : 'grid'} />
              <text x={MARGIN.left - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                {formatCompact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} className="tick" textAnchor="middle">
              {xLabel(i)}
            </text>
          ))}
          {active !== null && <line className="crosshair" x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + plotH} />}
          {series.map((s) =>
            s.values.length ? (
              <g key={s.name}>
                <polyline
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* 끝점 */}
                <circle
                  cx={x(s.values.length - 1)}
                  cy={y(s.values[s.values.length - 1])}
                  r={4}
                  fill={s.color}
                  className="dot-ring"
                />
                {active !== null && active < s.values.length && (
                  <circle cx={x(active)} cy={y(s.values[active])} r={4.5} fill={s.color} className="dot-ring" />
                )}
              </g>
            ) : null,
          )}
        </svg>
      )}
      {active !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(x(active), 80), width - 80), top: 0 }}
          onClick={() => setActive(null)}
        >
          <div className="tooltip-title">{tooltipTitle ? tooltipTitle(active) : `${xLabel(active)}까지 누적`}</div>
          {series.map((s) => (
            <div className="tooltip-row" key={s.name}>
              <span className="swatch" style={{ background: s.color }} />
              <span>{s.name}</span>
              <b>{active < s.values.length ? formatWon(s.values[active]) : '-'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
