import { useLayoutEffect, useRef, useState } from 'react'

/** 요소의 실제 너비를 따라가서 SVG를 늘이지 않고 픽셀 단위로 그린다(글자 크기 유지). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** 0을 포함하는 깔끔한 눈금 (1·2·2.5·5 × 10ⁿ 간격) */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v))
  return ticks
}

/** 데이터 쪽 끝만 4px 둥글린 막대 경로 (기준선 쪽은 각짐) */
export function barPath(x: number, w: number, yBase: number, yEnd: number): string {
  const h = Math.abs(yEnd - yBase)
  if (h < 0.5) return ''
  const r = Math.min(4, w / 2, h)
  if (yEnd < yBase) {
    // 위로 자라는 막대
    return `M${x},${yBase}V${yEnd + r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + r}V${yBase}Z`
  }
  return `M${x},${yBase}V${yEnd - r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd - r}V${yBase}Z`
}
