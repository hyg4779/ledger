import { useMemo } from 'react'
import { useWidth } from '../components/chartUtils'
import { Donut } from '../components/Donut'
import { InfoIcon } from '../components/Icons'
import { LineChart } from '../components/LineChart'
import { ASSET_TYPE_ORDER, ASSET_TYPES, daysSince, latestSnapshot, monthlyNetWorth, netWorthNow, totalsByType } from '../lib/assets'
import { monthLabel } from '../lib/dates'
import { formatNumber, formatPercent, formatWon } from '../lib/format'
import { useLedger } from '../lib/store'
import type { Asset } from '../lib/types'

const SLICE_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']
/** 이만큼 지나면 '업데이트 필요'로 표시 */
const STALE_DAYS = 35

interface Props {
  onAddAsset: () => void
  onOpenAsset: (asset: Asset) => void
  onBulkUpdate: () => void
  onOpenLoans: () => void
}

export function AssetsScreen({ onAddAsset, onOpenAsset, onBulkUpdate, onOpenLoans }: Props) {
  const { data } = useLedger()
  const [donutRef, donutWidth] = useWidth<HTMLDivElement>()

  const now = netWorthNow(data)
  const byType = useMemo(() => totalsByType(data), [data])
  const trend = useMemo(() => monthlyNetWorth(data), [data])
  const active = data.assets.filter((a) => !a.closed)
  const closed = data.assets.filter((a) => a.closed)

  const investShare = now.assets
    ? byType.filter((r) => ASSET_TYPES[r.type].group === 'invest').reduce((a, r) => a + r.value, 0) / now.assets
    : NaN
  const prevMonth = trend.length >= 2 ? trend[trend.length - 2] : null

  const slices: { key: string; value: number; color: string }[] = byType
    .slice(0, 5)
    .map((r, i) => ({ key: r.type, value: r.value, color: SLICE_COLORS[i] }))
  const rest = byType.slice(5).reduce((a, r) => a + r.value, 0)
  if (rest > 0) slices.push({ key: 'etc-group', value: rest, color: 'var(--c-other)' })

  return (
    <div className="screen">
      <div className="page-head">
        <div className="eyebrow">ASSETS</div>
        <h1 className="page-title">자산</h1>
        <p className="page-sub">투자·예금·보증금에서 대출을 뺀 내 순자산.</p>
      </div>

      {active.length === 0 ? (
        <section className="card">
          <h2 className="card-title">등록된 자산이 없어요</h2>
          <p className="card-sub" style={{ marginTop: 8 }}>
            해외주식·국내주식·암호화폐·예적금·보증금처럼 계좌나 종류별로 하나씩 만들고, 지금 평가금액만 적어 주세요. 한 달에 한 번 업데이트하면 순자산
            추이가 그래프로 쌓여요.
          </p>
          <button type="button" className="primary-btn" onClick={onAddAsset}>
            ＋ 자산 추가
          </button>
        </section>
      ) : (
        <>
          <section className="card lime">
            <span className="lime-label">순자산 (자산 − 대출)</span>
            <strong className={now.net < 0 ? 'lime-big neg' : 'lime-big'}>{formatWon(now.net)}</strong>
            {prevMonth && (
              <span className="lime-sub">
                지난달 말보다 {now.net - prevMonth.net >= 0 ? '▲' : '▼'} {formatWon(Math.abs(now.net - prevMonth.net))}
              </span>
            )}
            <hr />
            <div className="lime-row">
              <span>총자산</span>
              <b>{formatWon(now.assets)}</b>
            </div>
            <button type="button" className="lime-row link-row" onClick={onOpenLoans}>
              <span>대출 (부채) ›</span>
              <b>−{formatWon(now.debts)}</b>
            </button>
            {Number.isFinite(investShare) && (
              <div className="lime-row" style={{ marginTop: 8 }}>
                <span>투자 자산 비중</span>
                <b>{formatPercent(investShare)}</b>
              </div>
            )}
          </section>

          <section className="card big">
            <div className="card-top">
              <div>
                <div className="eyebrow">ALLOCATION</div>
                <h2 className="card-title">자산 구성</h2>
              </div>
              <button type="button" className="tag link" onClick={onBulkUpdate}>
                한 번에 업데이트
              </button>
            </div>
            <div className="donut-wrap" ref={donutRef}>
              {donutWidth > 0 && (
                <Donut
                  size={Math.min(260, donutWidth)}
                  slices={slices}
                  center={
                    <>
                      <span className="donut-label">총자산</span>
                      <strong className="donut-value small">
                        {formatNumber(now.assets / 10_000)}
                        <small>만원</small>
                      </strong>
                    </>
                  }
                />
              )}
            </div>
            <ul className="legend-list">
              {slices.map((s) => (
                <li key={s.key}>
                  <div className="legend-row">
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="legend-name">{s.key === 'etc-group' ? '그 외' : ASSET_TYPES[s.key as keyof typeof ASSET_TYPES].label}</span>
                    <span className="legend-amt">{formatWon(s.value)}</span>
                    <span className="legend-pct">{formatPercent(s.value / now.assets)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {trend.length >= 2 && (
            <section className="card">
              <div className="eyebrow">TREND</div>
              <h2 className="card-title">월별 자산 추이</h2>
              <p className="card-sub" style={{ marginTop: 6 }}>
                매달 말 기준. 그 달에 기록이 없으면 직전 평가금액으로 계산해요.
              </p>
              <div className="legend">
                <span>
                  <span className="swatch" style={{ background: 'var(--c3)' }} />
                  총자산
                </span>
                <span>
                  <span className="swatch" style={{ background: 'var(--c1)' }} />
                  순자산
                </span>
              </div>
              <LineChart
                series={[
                  { name: '총자산', color: 'var(--c3)', values: trend.map((t) => t.assets) },
                  { name: '순자산', color: 'var(--c1)', values: trend.map((t) => t.net) },
                ]}
                xLabel={(i) => `${Number(trend[i].month.slice(5))}월`}
                tooltipTitle={(i) => `${monthLabel(trend[i].month)} 말`}
                xTicks={[0, Math.floor((trend.length - 1) / 2), trend.length - 1]}
              />
            </section>
          )}

          {ASSET_TYPE_ORDER.filter((t) => active.some((a) => a.type === t)).map((t) => {
            const list = active.filter((a) => a.type === t)
            const subtotal = list.reduce((a, x) => a + (latestSnapshot(x.id, data.assetSnapshots)?.value ?? 0), 0)
            return (
              <section key={t} className="asset-group">
                <header>
                  <span>
                    {ASSET_TYPES[t].emoji} {ASSET_TYPES[t].label}
                  </span>
                  <span>{formatWon(subtotal)}</span>
                </header>
                <ul className="tx-list">
                  {list.map((a) => (
                    <AssetRow key={a.id} asset={a} onOpen={() => onOpenAsset(a)} />
                  ))}
                </ul>
              </section>
            )
          })}

          <div className="btn-row">
            <button type="button" className="secondary-btn" onClick={onBulkUpdate}>
              한 번에 업데이트
            </button>
            <button type="button" className="secondary-btn" onClick={onAddAsset}>
              ＋ 자산 추가
            </button>
          </div>
        </>
      )}

      {closed.length > 0 && (
        <section className="card">
          <h3>정리한 자산</h3>
          <ul className="tx-list flat">
            {closed.map((a) => (
              <AssetRow key={a.id} asset={a} onOpen={() => onOpenAsset(a)} />
            ))}
          </ul>
        </section>
      )}

      <p className="foot-note">
        <InfoIcon /> 평가금액은 직접 적은 값이에요. 시세를 자동으로 가져오지 않아요.
      </p>
    </div>
  )
}

function AssetRow({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const { data } = useLedger()
  const last = latestSnapshot(asset.id, data.assetSnapshots)
  const since = last ? daysSince(last.date) : null
  const stale = since !== null && since >= STALE_DAYS
  const ret = last?.principal ? (last.value - last.principal) / last.principal : null
  return (
    <li>
      <button type="button" className="tx-row" onClick={onOpen}>
        <span className="tx-emoji" aria-hidden>
          {ASSET_TYPES[asset.type].emoji}
        </span>
        <span className="tx-text">
          <span className="tx-memo">{asset.name}</span>
          <span className={stale ? 'tx-cat stale' : 'tx-cat'}>
            {since === null ? '평가금액 없음' : since === 0 ? '오늘 업데이트' : `${since}일 전 업데이트`}
            {stale && ' · 업데이트 필요'}
          </span>
        </span>
        <span className="asset-amt">
          <b className="tx-amt">{formatWon(last?.value ?? 0)}</b>
          {ret !== null && (
            <span className={ret >= 0 ? 'ret up' : 'ret down'}>
              {ret >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(ret))}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
