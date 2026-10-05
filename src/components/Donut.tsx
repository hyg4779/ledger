import type { ReactNode } from 'react'

export interface DonutSlice {
  key: string
  value: number
  color: string
}

interface Props {
  slices: DonutSlice[]
  /** 선택된 조각 — 나머지는 흐려진다 */
  activeKey?: string | null
  onSelect?: (key: string | null) => void
  center: ReactNode
  size?: number
}

const STROKE = 34
const GAP_PX = 10

/** 끝이 둥근 두꺼운 도넛. 조각 사이는 표면색 틈으로 구분한다. */
export function Donut({ slices, activeKey, onSelect, center, size = 280 }: Props) {
  const r = (size - STROKE) / 2
  const c = size / 2
  const total = slices.reduce((a, s) => a + s.value, 0)
  // 둥근 끝(반지름 STROKE/2)과 틈을 각도로 환산
  const capAngle = STROKE / 2 / r
  const gapAngle = GAP_PX / r

  const point = (angle: number) => [c + r * Math.cos(angle), c + r * Math.sin(angle)]

  // 아주 작은 조각도 둥근 끝 두 개 + 틈만큼은 자리를 차지해야 겹치지 않는다.
  // 작은 조각에 최소 각도를 주고, 그만큼 큰 조각들에서 비율대로 덜어낸다.
  const minSweep = 2 * capAngle + gapAngle + 0.04
  const raw = slices.map((s) => (total ? (s.value / total) * Math.PI * 2 : 0))
  const small = raw.map((v) => slices.length > 1 && v < minSweep)
  const reserved = small.reduce((a, isSmall) => a + (isSmall ? minSweep : 0), 0)
  const bigTotal = raw.reduce((a, v, i) => a + (small[i] ? 0 : v), 0)
  const sweeps = raw.map((v, i) => (small[i] ? minSweep : bigTotal ? (v / bigTotal) * (Math.PI * 2 - reserved) : 0))

  let cursor = -Math.PI / 2
  const arcs = slices.map((s, i) => {
    const sweep = sweeps[i]
    const start = cursor
    cursor += sweep
    // 한 조각뿐이면 꽉 찬 원
    if (slices.length === 1) return { s, full: true, d: '' }
    const pad = capAngle + gapAngle / 2
    let a0 = start + pad
    let a1 = start + sweep - pad
    if (a1 < a0) a0 = a1 = start + sweep / 2
    const [x0, y0] = point(a0)
    const [x1, y1] = point(a1)
    const large = a1 - a0 > Math.PI ? 1 : 0
    return { s, full: false, d: `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}` }
  })

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="카테고리별 지출 비중 도넛 그래프">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
        {arcs.map(({ s, full, d }) => {
          const dim = activeKey && activeKey !== s.key
          const common = {
            fill: 'none',
            stroke: s.color,
            strokeWidth: activeKey === s.key ? STROKE + 6 : STROKE,
            strokeLinecap: 'round' as const,
            opacity: dim ? 0.3 : 1,
            className: 'donut-arc',
            onClick: () => onSelect?.(activeKey === s.key ? null : s.key),
          }
          return full ? <circle key={s.key} cx={c} cy={c} r={r} {...common} /> : <path key={s.key} d={d} {...common} />
        })}
      </svg>
      <div className="donut-center">{center}</div>
    </div>
  )
}
