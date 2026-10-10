import { balanceAt, currentBalance } from './loans'
import type { Asset, AssetSnapshot, AssetType, LedgerData } from './types'

export const ASSET_TYPES: Record<AssetType, { label: string; emoji: string; group: 'invest' | 'safe' | 'property' }> = {
  overseasStock: { label: '해외주식', emoji: '🌎', group: 'invest' },
  domesticStock: { label: '국내주식', emoji: '📊', group: 'invest' },
  crypto: { label: '암호화폐', emoji: '🪙', group: 'invest' },
  pension: { label: '연금·IRP', emoji: '🧓', group: 'invest' },
  deposit: { label: '예·적금', emoji: '🏦', group: 'safe' },
  cash: { label: '입출금·현금', emoji: '💵', group: 'safe' },
  housingDeposit: { label: '전월세 보증금', emoji: '🏠', group: 'property' },
  realEstate: { label: '부동산', emoji: '🏢', group: 'property' },
  etc: { label: '기타 자산', emoji: '📦', group: 'safe' },
}

export const ASSET_TYPE_ORDER = Object.keys(ASSET_TYPES) as AssetType[]

/** 자산별 스냅숏을 날짜순으로 */
function snapshotsOf(assetId: string, snapshots: AssetSnapshot[]): AssetSnapshot[] {
  return snapshots.filter((s) => s.assetId === assetId).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

/** 해당 날짜(포함)까지의 가장 최근 스냅숏 */
export function snapshotAt(assetId: string, snapshots: AssetSnapshot[], dateKey: string): AssetSnapshot | undefined {
  let found: AssetSnapshot | undefined
  for (const s of snapshotsOf(assetId, snapshots)) {
    if (s.date > dateKey) break
    found = s
  }
  return found
}

export function latestSnapshot(assetId: string, snapshots: AssetSnapshot[]): AssetSnapshot | undefined {
  const list = snapshotsOf(assetId, snapshots)
  return list[list.length - 1]
}

/** 바로 앞 스냅숏 (변동 표시용) */
export function previousSnapshot(assetId: string, snapshots: AssetSnapshot[]): AssetSnapshot | undefined {
  const list = snapshotsOf(assetId, snapshots)
  return list[list.length - 2]
}

export function activeAssets(data: LedgerData): Asset[] {
  return data.assets.filter((a) => !a.closed)
}

/** 지금 기준 총자산·총부채·순자산 */
export function netWorthNow(data: LedgerData) {
  const assets = activeAssets(data).reduce((a, x) => a + (latestSnapshot(x.id, data.assetSnapshots)?.value ?? 0), 0)
  const debts = data.loans.filter((l) => !l.closed).reduce((a, l) => a + currentBalance(l, data.loanPayments), 0)
  return { assets, debts, net: assets - debts }
}

/** 최근 maxMonths개월의 월말 총자산·부채·순자산. 자산 기록이 처음 생긴 달부터 */
export function monthlyNetWorth(data: LedgerData, maxMonths = 24) {
  const now = new Date()
  const months: { key: string; end: string }[] = []
  for (let i = maxMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    months.push({ key, end: `${key}-${String(last).padStart(2, '0')}` })
  }
  const firstSnap = data.assetSnapshots.reduce((min, s) => (s.date < min ? s.date : min), '9999-99-99')
  const loans = data.loans.filter((l) => !l.closed)
  const rows = months
    .filter((m) => m.end >= firstSnap)
    .map((m) => {
      // 정리한 자산도 그 당시 가치는 이력에 포함한다.
      const assets = data.assets.reduce((a, x) => a + (snapshotAt(x.id, data.assetSnapshots, m.end)?.value ?? 0), 0)
      const debts = loans.reduce((a, l) => a + balanceAt(l, data.loanPayments, m.end), 0)
      return { month: m.key, assets, debts, net: assets - debts }
    })
  return rows
}

/** 자산 유형별 합계 (현재) */
export function totalsByType(data: LedgerData): { type: AssetType; value: number }[] {
  const map = new Map<AssetType, number>()
  for (const a of activeAssets(data)) {
    const v = latestSnapshot(a.id, data.assetSnapshots)?.value ?? 0
    map.set(a.type, (map.get(a.type) ?? 0) + v)
  }
  return [...map.entries()]
    .map(([type, value]) => ({ type, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
}

/** 오늘로부터 며칠 전인지 */
export function daysSince(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000)
}
