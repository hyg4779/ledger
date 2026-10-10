import { useMemo, useState, type ReactNode } from 'react'
import { ASSET_TYPE_ORDER, ASSET_TYPES, latestSnapshot } from '../lib/assets'
import { dayLabel, todayKey } from '../lib/dates'
import { formatNumber, formatPercent, formatWon, parseAmount } from '../lib/format'
import { actions, newId, useLedger } from '../lib/store'
import type { Asset, AssetType } from '../lib/types'

const amountProps = (value: string, set: (v: string) => void, onChange?: () => void) => ({
  inputMode: 'numeric' as const,
  value,
  placeholder: '0',
  onChange: (e: { target: { value: string } }) => {
    const n = parseAmount(e.target.value)
    set(n ? formatNumber(n) : '')
    onChange?.()
  },
})

function SheetFrame({ title, onClose, onSave, saveLabel = '저장', children }: { title: string; onClose: () => void; onSave: () => void; saveLabel?: string; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button type="button" className="text-btn" onClick={onClose}>
            취소
          </button>
          <h2>{title}</h2>
          <button type="button" className="text-btn strong" onClick={onSave}>
            {saveLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 자산 추가·정보 수정. 새 자산이면 현재 평가금액도 함께 받는다. */
export function AssetSheet({ editing, onClose }: { editing: Asset | null; onClose: () => void }) {
  const [type, setType] = useState<AssetType>(editing?.type ?? 'overseasStock')
  const [name, setName] = useState(editing?.name ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [valueText, setValueText] = useState('')
  const [principalText, setPrincipalText] = useState('')
  const [closed, setClosed] = useState(!!editing?.closed)
  const [error, setError] = useState('')

  function save() {
    const value = parseAmount(valueText)
    if (!editing && value <= 0 && !window.confirm('평가금액이 0원이에요. 그대로 추가할까요?')) return
    const asset: Asset = {
      id: editing?.id ?? newId(),
      name: name.trim() || ASSET_TYPES[type].label,
      type,
      memo: memo.trim(),
      closed: closed || undefined,
      createdAt: editing?.createdAt ?? Date.now(),
    }
    actions.saveAsset(asset)
    if (!editing) {
      const principal = parseAmount(principalText)
      actions.saveSnapshots([{ assetId: asset.id, date: todayKey(), value, principal: principal || undefined }])
    }
    onClose()
  }

  function remove() {
    if (!editing) return
    if (!window.confirm('이 자산과 지금까지의 평가금액 기록을 모두 지울까요?\n(팔았거나 해지했다면 삭제 대신 "정리한 자산"을 켜면 과거 그래프가 보존돼요)')) return
    actions.deleteAsset(editing.id)
    onClose()
  }

  return (
    <SheetFrame title={editing ? '자산 정보 수정' : '자산 추가'} onClose={onClose} onSave={save}>
      <div className="field-label">종류</div>
      <div className="chips">
        {ASSET_TYPE_ORDER.map((t) => (
          <button key={t} type="button" className={t === type ? 'chip on' : 'chip'} onClick={() => setType(t)}>
            {ASSET_TYPES[t].emoji} {ASSET_TYPES[t].label}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`예: ${ASSET_TYPES[type].label === '해외주식' ? '토스증권 해외주식' : ASSET_TYPES[type].label}`} maxLength={24} />
      </label>
      {!editing && (
        <div className="two-col">
          <label className="field">
            <span className="field-label">지금 평가금액 (원)</span>
            <input {...amountProps(valueText, setValueText, () => setError(''))} />
          </label>
          <label className="field">
            <span className="field-label">투자 원금 (선택)</span>
            <input {...amountProps(principalText, setPrincipalText)} />
          </label>
        </div>
      )}
      <label className="field">
        <span className="field-label">메모 (선택)</span>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 증권사, 계좌 끝자리" maxLength={40} />
      </label>
      {!editing && <p className="hint">평가금액은 앱·계좌에 보이는 총액만 적으면 돼요. 매일 적을 필요 없이 한 달에 한 번 정도 업데이트하면 추이가 쌓여요.</p>}
      {editing && (
        <label className="check-row">
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
          정리한 자산 (매도·해지 — 합계에서 빼요)
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="primary-btn" onClick={save}>
        {editing ? '수정 완료' : '자산 추가'}
      </button>
      {editing && (
        <button type="button" className="danger-btn" onClick={remove}>
          삭제
        </button>
      )}
    </SheetFrame>
  )
}

/** 평가금액 업데이트 + 기록 이력 */
export function AssetValueSheet({ asset, onClose, onEditInfo }: { asset: Asset; onClose: () => void; onEditInfo: () => void }) {
  const { data } = useLedger()
  const last = latestSnapshot(asset.id, data.assetSnapshots)
  const [valueText, setValueText] = useState(last ? formatNumber(last.value) : '')
  const [principalText, setPrincipalText] = useState(last?.principal ? formatNumber(last.principal) : '')
  const [date, setDate] = useState(todayKey())
  const history = useMemo(
    () =>
      data.assetSnapshots
        .filter((s) => s.assetId === asset.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 24),
    [data.assetSnapshots, asset.id],
  )
  const value = parseAmount(valueText)
  const diff = last ? value - last.value : 0

  function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const principal = parseAmount(principalText)
    actions.saveSnapshots([{ assetId: asset.id, date, value, principal: principal || undefined }])
    onClose()
  }

  return (
    <SheetFrame title="평가금액 업데이트" onClose={onClose} onSave={save}>
      <div className="loan-mini">
        <span className="tx-emoji" aria-hidden>
          {ASSET_TYPES[asset.type].emoji}
        </span>
        <div>
          <b>{asset.name}</b>
          <span>{last ? `마지막 기록 ${dayLabel(last.date)} · ${formatWon(last.value)}` : '아직 기록이 없어요'}</span>
        </div>
      </div>
      <label className="amount-field">
        <input {...amountProps(valueText, setValueText)} aria-label="평가금액" autoFocus />
        <span>원</span>
      </label>
      {last && value > 0 && diff !== 0 && (
        <p className={diff > 0 ? 'delta good' : 'delta bad'} style={{ margin: 0 }}>
          {diff > 0 ? '▲' : '▼'} 지난 기록보다 {formatWon(Math.abs(diff))} ({formatPercent(Math.abs(diff) / last.value)})
        </p>
      )}
      <div className="two-col">
        <label className="field">
          <span className="field-label">기준일</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">투자 원금 (선택)</span>
          <input {...amountProps(principalText, setPrincipalText)} />
        </label>
      </div>
      <p className="hint">원금을 적어 두면 수익률을 계산해요. 같은 날짜로 다시 저장하면 그날 기록을 덮어써요.</p>
      <button type="button" className="primary-btn" onClick={save}>
        저장
      </button>
      <button type="button" className="secondary-btn" onClick={onEditInfo}>
        이름·종류 수정 / 정리
      </button>

      {history.length > 0 && (
        <>
          <div className="field-label">기록 이력</div>
          <ul className="pay-history">
            {history.map((s) => (
              <li key={s.id}>
                <span className="pay-date">{dayLabel(s.date)}</span>
                <span className="pay-amts">
                  {formatWon(s.value)}
                  {s.principal ? <small className="muted"> · 원금 {formatWon(s.principal)}</small> : null}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="이 기록 삭제"
                  onClick={() => window.confirm('이 평가금액 기록을 삭제할까요?') && actions.deleteSnapshot(s.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </SheetFrame>
  )
}

/** 모든 자산을 한 화면에서 한 번에 업데이트 — 한 달에 한 번 몰아서 적기 좋게 */
export function BulkAssetSheet({ onClose }: { onClose: () => void }) {
  const { data } = useLedger()
  const assets = data.assets.filter((a) => !a.closed)
  const [date, setDate] = useState(todayKey())
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(assets.map((a) => [a.id, formatNumber(latestSnapshot(a.id, data.assetSnapshots)?.value ?? 0)])),
  )

  function save() {
    const entries = assets
      .filter((a) => values[a.id] !== undefined && values[a.id] !== '')
      .map((a) => {
        const last = latestSnapshot(a.id, data.assetSnapshots)
        return { assetId: a.id, date, value: parseAmount(values[a.id]), principal: last?.principal }
      })
    actions.saveSnapshots(entries)
    onClose()
  }

  const total = assets.reduce((a, x) => a + parseAmount(values[x.id] ?? ''), 0)

  return (
    <SheetFrame title="한 번에 업데이트" onClose={onClose} onSave={save}>
      <p className="hint">앱·계좌에 보이는 지금 총액으로 고쳐 주세요. 바뀌지 않은 건 그대로 두면 돼요.</p>
      <label className="field">
        <span className="field-label">기준일</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <ul className="bulk-list">
        {assets.map((a) => (
          <li key={a.id}>
            <span className="bulk-name">
              <span aria-hidden>{ASSET_TYPES[a.type].emoji}</span> {a.name}
            </span>
            <input
              {...amountProps(values[a.id] ?? '', (v) => setValues((prev) => ({ ...prev, [a.id]: v })))}
              aria-label={`${a.name} 평가금액`}
            />
          </li>
        ))}
      </ul>
      <div className="bulk-total">
        <span>합계</span>
        <b>{formatWon(total)}</b>
      </div>
      <button type="button" className="primary-btn" onClick={save}>
        모두 저장
      </button>
    </SheetFrame>
  )
}
