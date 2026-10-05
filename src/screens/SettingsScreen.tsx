import { useRef, useState } from 'react'
import { exportCsv, exportJson, readJsonFile } from '../lib/backup'
import { formatNumber, formatWon, parseAmount } from '../lib/format'
import { buildSampleData } from '../lib/sampleData'
import { actions, isLedgerData, newId, useLedger } from '../lib/store'
import type { Category, ThemeMode, TxType } from '../lib/types'

export function SettingsScreen() {
  const { data } = useLedger()
  const fileRef = useRef<HTMLInputElement>(null)
  const [catType, setCatType] = useState<TxType>('expense')
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [message, setMessage] = useState('')

  async function onImport(file: File) {
    try {
      const parsed = await readJsonFile(file)
      if (!isLedgerData(parsed)) throw new Error('가계부 백업 파일이 아니에요')
      if (!window.confirm(`내역 ${parsed.transactions.length}건으로 지금 데이터를 모두 바꿀까요?\n(현재 ${data.transactions.length}건은 사라져요)`)) return
      actions.replaceAll(parsed)
      setMessage(`불러오기 완료: ${parsed.transactions.length}건`)
    } catch (e) {
      setMessage(`불러오기 실패: ${(e as Error).message}`)
    }
  }

  const budgetTotalOfCats = data.categories.filter((c) => c.type === 'expense' && !c.hidden).reduce((a, c) => a + (c.budget ?? 0), 0)

  return (
    <div className="screen">
      <div className="page-head">
        <div className="eyebrow">SETTINGS</div>
        <h1 className="page-title">설정</h1>
      </div>

      <section className="card">
        <h3>월 예산</h3>
        <p className="card-sub">한 달 전체 지출 목표예요. 0이면 표시하지 않아요</p>
        <AmountInput key={data.monthlyBudget ?? 0} value={data.monthlyBudget ?? 0} onCommit={(v) => actions.setMonthlyBudget(v)} />
        {budgetTotalOfCats > 0 && <p className="card-sub">카테고리 예산 합계: {formatWon(budgetTotalOfCats)}</p>}
      </section>

      <section className="card">
        <h3>카테고리</h3>
        <div className="segmented">
          <button type="button" className={catType === 'expense' ? 'on expense' : ''} onClick={() => setCatType('expense')}>
            지출
          </button>
          <button type="button" className={catType === 'income' ? 'on income' : ''} onClick={() => setCatType('income')}>
            수입
          </button>
        </div>
        <ul className="cat-list">
          {data.categories
            .filter((c) => c.type === catType)
            .map((c) => (
              <li key={c.id} className={c.hidden ? 'hidden-cat' : ''}>
                <button type="button" className="cat-list-main" onClick={() => setEditingCat(c)}>
                  <span aria-hidden>{c.emoji}</span>
                  <span className="cat-list-name">
                    {c.name}
                    {c.hidden && <small> (숨김)</small>}
                  </span>
                  {c.type === 'expense' && c.budget ? <span className="cat-list-budget">예산 {formatWon(c.budget)}</span> : null}
                </button>
                <button type="button" className="icon-btn small" aria-label="위로" onClick={() => actions.moveCategory(c.id, -1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn small" aria-label="아래로" onClick={() => actions.moveCategory(c.id, 1)}>
                  ↓
                </button>
              </li>
            ))}
        </ul>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setEditingCat({ id: newId(), type: catType, name: '', emoji: catType === 'expense' ? '🧾' : '💵' })}
        >
          ＋ 카테고리 추가
        </button>
      </section>

      <section className="card">
        <h3>화면</h3>
        <div className="segmented">
          {(
            [
              ['system', '시스템'],
              ['light', '라이트'],
              ['dark', '다크'],
            ] as [ThemeMode, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" className={data.theme === v ? 'on' : ''} onClick={() => actions.setTheme(v)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>백업</h3>
        <p className="card-sub">
          데이터는 이 폰 안에만 저장돼요. 폰을 바꾸거나 앱을 지우면 사라지니 <b>한 달에 한 번</b> 백업 파일을 저장해 두세요.
        </p>
        <div className="btn-col">
          <button type="button" className="secondary-btn" onClick={() => exportJson(data)}>
            백업 파일 저장 (JSON)
          </button>
          <button type="button" className="secondary-btn" onClick={() => fileRef.current?.click()}>
            백업 파일 불러오기
          </button>
          <button type="button" className="secondary-btn" onClick={() => exportCsv(data)}>
            엑셀용 내보내기 (CSV)
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
        {message && <p className="card-sub">{message}</p>}
      </section>

      <section className="card">
        <h3>데이터</h3>
        <p className="card-sub">총 {formatNumber(data.transactions.length)}건 기록됨</p>
        <div className="btn-col">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              if (!window.confirm('최근 14개월치 예시 내역을 추가할까요? 그래프를 미리 볼 때 쓰고, 나중에 "전체 삭제"로 지우면 돼요.')) return
              actions.addSample(buildSampleData())
              setMessage('예시 데이터를 넣었어요')
            }}
          >
            예시 데이터 넣어보기
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              if (!window.confirm('모든 내역과 카테고리 설정을 지울까요? 되돌릴 수 없어요.')) return
              if (!window.confirm('정말 지울까요? 백업 파일이 없다면 복구할 수 없어요.')) return
              actions.resetAll()
            }}
          >
            전체 삭제
          </button>
        </div>
      </section>

      <section className="card">
        <h3>홈 화면에 앱 추가하기</h3>
        <ul className="howto">
          <li>
            <b>아이폰</b>: Safari로 이 페이지 열기 → 아래 공유 버튼(□↑) → <b>홈 화면에 추가</b>
          </li>
          <li>
            <b>안드로이드</b>: Chrome으로 열기 → 오른쪽 위 ⋮ → <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>
          </li>
        </ul>
      </section>

      {editingCat && <CategoryEditor category={editingCat} onClose={() => setEditingCat(null)} />}
    </div>
  )
}

function AmountInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(value ? formatNumber(value) : '')
  return (
    <label className="inline-amount">
      <input
        inputMode="numeric"
        placeholder="0"
        value={text}
        onChange={(e) => {
          const n = parseAmount(e.target.value)
          setText(n ? formatNumber(n) : '')
        }}
        onBlur={() => onCommit(parseAmount(text))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span>원</span>
    </label>
  )
}

const EMOJI_CHOICES = ['🍚', '☕', '🍺', '🛒', '🧻', '🚇', '🚗', '⛽', '🏠', '💡', '📱', '🛍️', '👕', '💄', '💊', '🏋️', '🎬', '✈️', '🎁', '🐶', '👶', '📚', '🛡️', '🏦', '💳', '🧾', '📦', '💼', '🎉', '📈', '💰', '💵', '🪙']

function CategoryEditor({ category, onClose }: { category: Category; onClose: () => void }) {
  const { data } = useLedger()
  const isNew = !data.categories.some((c) => c.id === category.id)
  const [name, setName] = useState(category.name)
  const [emoji, setEmoji] = useState(category.emoji)
  const [budgetText, setBudgetText] = useState(category.budget ? formatNumber(category.budget) : '')
  const [hidden, setHidden] = useState(!!category.hidden)
  const used = data.transactions.filter((t) => t.categoryId === category.id).length

  function save() {
    if (!name.trim()) return
    const budget = parseAmount(budgetText)
    actions.saveCategory({ ...category, name: name.trim(), emoji, budget: budget || undefined, hidden: hidden || undefined })
    onClose()
  }

  function remove() {
    const msg = used
      ? `이 카테고리에 내역이 ${used}건 있어서 삭제 대신 숨길게요. 숨기면 입력 목록에서만 빠져요.`
      : '이 카테고리를 삭제할까요?'
    if (!window.confirm(msg)) return
    actions.removeCategory(category.id)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button type="button" className="text-btn" onClick={onClose}>
            취소
          </button>
          <h2>{isNew ? '카테고리 추가' : '카테고리 수정'}</h2>
          <button type="button" className="text-btn strong" onClick={save} disabled={!name.trim()}>
            저장
          </button>
        </div>
        <label className="field">
          <span className="field-label">이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="예: 반려동물" autoFocus={isNew} />
        </label>
        <div className="field-label">아이콘</div>
        <div className="emoji-grid">
          {[...new Set([emoji, ...EMOJI_CHOICES])].map((e) => (
            <button key={e} type="button" className={e === emoji ? 'emoji-cell on' : 'emoji-cell'} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
        {category.type === 'expense' && (
          <label className="field">
            <span className="field-label">이 카테고리 월 예산 (선택)</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={budgetText}
              onChange={(e) => {
                const n = parseAmount(e.target.value)
                setBudgetText(n ? formatNumber(n) : '')
              }}
            />
          </label>
        )}
        {!isNew && (
          <label className="check-row">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            입력 목록에서 숨기기
          </label>
        )}
        <button type="button" className="primary-btn" onClick={save} disabled={!name.trim()}>
          저장
        </button>
        {!isNew && (
          <button type="button" className="danger-btn" onClick={remove}>
            {used ? '숨기기' : '삭제'}
          </button>
        )}
      </div>
    </div>
  )
}
