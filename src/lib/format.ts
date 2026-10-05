const wonFormatter = new Intl.NumberFormat('ko-KR')

export function formatWon(n: number): string {
  return `${wonFormatter.format(Math.round(n))}원`
}

export function formatNumber(n: number): string {
  return wonFormatter.format(Math.round(n))
}

/** 축 눈금·좁은 칸용 짧은 표기: 1.2억, 350만, 8,000 */
export function formatCompact(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return `${sign}${trim(abs / 100_000_000)}억`
  if (abs >= 10_000) return `${sign}${trim(abs / 10_000)}만`
  return `${sign}${wonFormatter.format(Math.round(abs))}`
}

function trim(v: number): string {
  return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '-'
  return `${Math.round(ratio * 1000) / 10}%`
}

/** 입력 중인 금액 문자열 → 숫자 (콤마 등 비숫자 제거) */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : 0
}
