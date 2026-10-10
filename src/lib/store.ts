import { useSyncExternalStore } from 'react'
import { del, get, keys, set } from 'idb-keyval'
import { createInitialData, DEFAULT_CATEGORIES } from './defaults'
import { LOAN_INTEREST_CATEGORY } from './loans'
import type { Asset, AssetSnapshot, Category, LedgerData, Loan, LoanPayment, ThemeMode, Transaction } from './types'

const STORAGE_KEY = 'ledger-data-v1'
/** IndexedDB가 실패할 때를 대비한 두 번째 사본 (localStorage) */
const MIRROR_KEY = 'ledger-data-mirror-v1'
/** 날짜별 자동 백업 (IndexedDB). 최근 AUTO_BACKUP_KEEP일치만 남긴다. */
const AUTO_BACKUP_PREFIX = 'ledger-auto-backup-'
const AUTO_BACKUP_KEEP = 14

interface StoreState {
  data: LedgerData
  loaded: boolean
  /** 마지막 저장 실패 메시지. 성공하면 null로 돌아간다. */
  saveError: string | null
  /**
   * 저장소를 읽지 못했을 때 true. 이때 저장하면 빈 데이터로 기존 기록을 덮어쓸 수 있으므로
   * 모든 변경을 막는다(가장 위험한 데이터 손실 경로).
   */
  readOnly: boolean
  /** 주 저장소가 비어 있어 사본·자동 백업에서 되살렸을 때 안내 문구 */
  recoveredFrom: string | null
}

let state: StoreState = { data: createInitialData(), loaded: false, saveError: null, readOnly: false, recoveredFrom: null }
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLedger(): StoreState {
  return useSyncExternalStore(subscribe, () => state)
}

export function getData(): LedgerData {
  return state.data
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function readMirror(): LedgerData | undefined {
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    return raw ? (JSON.parse(raw) as LedgerData) : undefined
  } catch {
    return undefined
  }
}

function writeMirror(data: LedgerData) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(data))
  } catch {
    // 용량 초과 등 — IndexedDB가 주 저장소이므로 사본 실패는 조용히 넘긴다.
  }
}

export function countRecords(d: Pick<LedgerData, 'transactions' | 'loans' | 'assets'>): number {
  return (d.transactions?.length ?? 0) + (d.loans?.length ?? 0) + (d.assets?.length ?? 0)
}

/** 최신 자동 백업 */
async function latestAutoBackup(): Promise<LedgerData | undefined> {
  const list = await listAutoBackups()
  return list.length ? get<LedgerData>(list[0].key) : undefined
}

export async function listAutoBackups(): Promise<{ key: string; date: string }[]> {
  const all = (await keys()).map(String).filter((k) => k.startsWith(AUTO_BACKUP_PREFIX))
  return all
    .map((key) => ({ key, date: key.slice(AUTO_BACKUP_PREFIX.length) }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function readAutoBackup(key: string): Promise<LedgerData | undefined> {
  return get<LedgerData>(key)
}

/** 하루 한 번, 앱을 열 때 그날의 자동 백업을 남긴다 */
async function writeDailyBackup(data: LedgerData) {
  if (!countRecords(data)) return
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const key = AUTO_BACKUP_PREFIX + today
  if (!(await get(key))) await set(key, data)
  const list = await listAutoBackups()
  for (const old of list.slice(AUTO_BACKUP_KEEP)) await del(old.key)
}

export async function loadLedger(): Promise<void> {
  // iOS 홈 화면 앱은 처음 열 때 IndexedDB 연결이 가끔 실패한다 — 몇 번 다시 시도한다.
  let saved: LedgerData | undefined
  let idbFailed = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      saved = await get<LedgerData>(STORAGE_KEY)
      idbFailed = false
      break
    } catch {
      idbFailed = true
      await sleep(400 * (attempt + 1))
    }
  }
  const mirror = readMirror()

  let chosen: LedgerData | undefined = saved
  let recoveredFrom: string | null = null
  // 주 저장소가 비었거나 사본이 더 최근이면 사본을 쓴다.
  if (mirror && (!saved || (mirror.savedAt ?? 0) > (saved.savedAt ?? 0))) {
    chosen = mirror
    if (!saved || countRecords(mirror) > countRecords(saved)) recoveredFrom = '보조 저장소'
  }
  if (!chosen && !idbFailed) {
    try {
      const backup = await latestAutoBackup()
      if (backup && countRecords(backup)) {
        chosen = backup
        recoveredFrom = '자동 백업'
      }
    } catch {
      /* 자동 백업도 못 읽으면 새로 시작 */
    }
  }

  if (idbFailed && !chosen) {
    state = {
      ...state,
      loaded: true,
      readOnly: true,
      saveError: '저장소를 열지 못했어요. 기존 기록을 지키기 위해 지금은 저장을 막아 두었어요. 앱을 완전히 종료했다가 다시 열어 주세요.',
    }
    emit()
    return
  }

  state = { ...state, data: chosen ? normalize(chosen) : state.data, loaded: true, recoveredFrom }
  emit()
  // 되살린 경우 주 저장소에도 다시 써 두고, 보조 사본이 없으면 바로 만든다.
  if (recoveredFrom) persist(state.data)
  else if (chosen && !mirror) writeMirror(state.data)
  writeDailyBackup(state.data).catch(() => {})
  // 브라우저가 공간 부족 시 데이터를 지우지 않도록 영구 저장을 요청한다.
  navigator.storage?.persist?.().catch(() => {})
}

/** 가져오기·이전 버전 데이터에서 빠진 필드를 채운다. */
function normalize(raw: LedgerData): LedgerData {
  const base = createInitialData()
  const categories = Array.isArray(raw.categories) && raw.categories.length ? raw.categories : base.categories
  // 기본 카테고리가 지워졌다면 내역 표시가 깨지지 않도록 되살린다(숨김 상태로).
  const known = new Set(categories.map((c) => c.id))
  const transactions = Array.isArray(raw.transactions) ? raw.transactions : []
  const missing = DEFAULT_CATEGORIES.filter(
    (c) => !known.has(c.id) && transactions.some((t) => t.categoryId === c.id),
  ).map((c) => ({ ...c, hidden: true }))
  let merged = [...categories, ...missing]
  // 구독 카테고리가 생기기 전 데이터: '통신·구독'을 '통신'으로 바꾸고 바로 뒤에 '구독'을 끼워 넣는다.
  if (!merged.some((c) => c.id === 'exp-subscription')) {
    merged = merged.map((c) => (c.id === 'exp-telecom' && c.name === '통신·구독' ? { ...c, name: '통신' } : c))
    const sub = DEFAULT_CATEGORIES.find((c) => c.id === 'exp-subscription')!
    const at = merged.findIndex((c) => c.id === 'exp-telecom')
    merged.splice(at >= 0 ? at + 1 : merged.length, 0, { ...sub })
  }
  return {
    version: 1,
    categories: merged,
    transactions,
    monthlyBudget: raw.monthlyBudget,
    theme: raw.theme ?? 'system',
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    loanPayments: Array.isArray(raw.loanPayments) ? raw.loanPayments : [],
    savedAt: raw.savedAt,
    lastExportAt: raw.lastExportAt,
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    assetSnapshots: Array.isArray(raw.assetSnapshots) ? raw.assetSnapshots : [],
  }
}

function persist(data: LedgerData) {
  writeMirror(data)
  set(STORAGE_KEY, data).then(
    () => {
      if (state.saveError) {
        state = { ...state, saveError: null }
        emit()
      }
    },
    (e) => {
      state = { ...state, saveError: `저장에 실패했어요(보조 저장소에는 저장됨): ${String(e)}` }
      emit()
    },
  )
}

function commit(next: LedgerData) {
  if (state.readOnly) {
    window.alert('저장소를 열지 못한 상태라 저장하지 않았어요. 앱을 완전히 종료했다가 다시 열어 주세요.')
    return
  }
  const data = { ...next, savedAt: Date.now() }
  state = { ...state, data }
  emit()
  persist(data)
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const actions = {
  saveTransaction(tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) {
    const d = state.data
    if (tx.id) {
      commit({
        ...d,
        transactions: d.transactions.map((t) => (t.id === tx.id ? { ...t, ...tx, id: t.id } : t)),
      })
    } else {
      commit({ ...d, transactions: [...d.transactions, { ...tx, id: newId(), createdAt: Date.now() }] })
    }
  },

  deleteTransaction(id: string) {
    const d = state.data
    commit({
      ...d,
      transactions: d.transactions.filter((t) => t.id !== id),
      loanPayments: d.loanPayments.map((p) => (p.interestTxId === id ? { ...p, interestTxId: undefined } : p)),
    })
  },

  saveCategory(cat: Category) {
    const d = state.data
    const exists = d.categories.some((c) => c.id === cat.id)
    commit({
      ...d,
      categories: exists ? d.categories.map((c) => (c.id === cat.id ? cat : c)) : [...d.categories, cat],
    })
  },

  /** 내역이 있는 카테고리는 지우지 않고 숨긴다. 반환값: 실제로 삭제했는지 */
  removeCategory(id: string): boolean {
    const d = state.data
    if (d.transactions.some((t) => t.categoryId === id)) {
      commit({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, hidden: true } : c)) })
      return false
    }
    commit({ ...d, categories: d.categories.filter((c) => c.id !== id) })
    return true
  },

  moveCategory(id: string, delta: -1 | 1) {
    const d = state.data
    const cat = d.categories.find((c) => c.id === id)
    if (!cat) return
    // 같은 유형 안에서만 순서를 바꾼다.
    const sameType = d.categories.filter((c) => c.type === cat.type)
    const idx = sameType.indexOf(cat)
    const target = sameType[idx + delta]
    if (!target) return
    const categories = d.categories.map((c) => (c === cat ? target : c === target ? cat : c))
    commit({ ...d, categories })
  },

  setMonthlyBudget(amount: number) {
    commit({ ...state.data, monthlyBudget: amount > 0 ? amount : undefined })
  },

  setTheme(theme: ThemeMode) {
    commit({ ...state.data, theme })
  },

  replaceAll(data: LedgerData) {
    // 덮어쓰기 직전 상태를 자동 백업으로 남겨 되돌릴 수 있게 한다.
    if (countRecords(state.data)) set(`${AUTO_BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}-before-restore`, state.data).catch(() => {})
    commit(normalize(data))
  },

  markExported() {
    commit({ ...state.data, lastExportAt: Date.now() })
  },

  dismissRecovered() {
    state = { ...state, recoveredFrom: null }
    emit()
  },

  addSample(sample: Pick<LedgerData, 'transactions' | 'loans' | 'loanPayments' | 'assets' | 'assetSnapshots'>) {
    const d = state.data
    commit({
      ...d,
      transactions: [...d.transactions, ...sample.transactions],
      loans: [...d.loans, ...sample.loans],
      loanPayments: [...d.loanPayments, ...sample.loanPayments],
      assets: [...d.assets, ...sample.assets],
      assetSnapshots: [...d.assetSnapshots, ...sample.assetSnapshots],
    })
  },

  /** 잔액을 직접 고친다. 이력을 남기도록 차이만큼 조정 기록을 추가한다. */
  adjustLoanBalance(loanId: string, newBalance: number, currentBalance: number, date: string) {
    const diff = currentBalance - newBalance
    if (diff === 0) return
    const d = state.data
    const adj: LoanPayment = { id: newId(), loanId, date, principal: diff, kind: 'adjust', createdAt: Date.now() }
    commit({ ...d, loanPayments: [...d.loanPayments, adj] })
  },

  saveAsset(asset: Asset) {
    const d = state.data
    const exists = d.assets.some((a) => a.id === asset.id)
    commit({ ...d, assets: exists ? d.assets.map((a) => (a.id === asset.id ? asset : a)) : [...d.assets, asset] })
  },

  deleteAsset(id: string) {
    const d = state.data
    commit({ ...d, assets: d.assets.filter((a) => a.id !== id), assetSnapshots: d.assetSnapshots.filter((s) => s.assetId !== id) })
  },

  /** 평가금액 기록. 같은 자산·같은 날짜 기록이 있으면 덮어쓴다(하루에 여러 번 고쳐도 하나만 남게). */
  saveSnapshots(entries: Omit<AssetSnapshot, 'id' | 'createdAt'>[]) {
    const d = state.data
    const now = Date.now()
    let snaps = d.assetSnapshots
    for (const e of entries) {
      snaps = snaps.filter((s) => !(s.assetId === e.assetId && s.date === e.date))
      snaps = [...snaps, { ...e, id: newId(), createdAt: now }]
    }
    commit({ ...d, assetSnapshots: snaps })
  },

  deleteSnapshot(id: string) {
    const d = state.data
    commit({ ...d, assetSnapshots: d.assetSnapshots.filter((s) => s.id !== id) })
  },

  saveLoan(loan: Loan) {
    const d = state.data
    const exists = d.loans.some((l) => l.id === loan.id)
    commit({ ...d, loans: exists ? d.loans.map((l) => (l.id === loan.id ? loan : l)) : [...d.loans, loan] })
  },

  /** 대출과 원금 상환 기록을 지운다. 이자 지출은 실제로 쓴 돈이므로 남기고 연결만 끊는다. */
  deleteLoan(id: string) {
    const d = state.data
    commit({
      ...d,
      loans: d.loans.filter((l) => l.id !== id),
      loanPayments: d.loanPayments.filter((p) => p.loanId !== id),
      transactions: d.transactions.map((t) => (t.loanId === id ? { ...t, loanId: undefined } : t)),
    })
  },

  /** 납부 1회 기록: 이자는 '대출이자' 지출로, 원금은 상환 기록으로 남긴다. */
  recordLoanPayment(input: { loan: Loan; date: string; interest: number; principal: number; memo: string; kind?: 'payment' | 'adjust' }) {
    const d = state.data
    const now = Date.now()
    const tx: Transaction | null =
      input.interest > 0
        ? {
            id: newId(),
            type: 'expense',
            amount: input.interest,
            categoryId: LOAN_INTEREST_CATEGORY,
            date: input.date,
            memo: input.memo || `${input.loan.name} 이자`,
            createdAt: now,
            loanId: input.loan.id,
          }
        : null
    const payment: LoanPayment = {
      id: newId(),
      loanId: input.loan.id,
      date: input.date,
      principal: input.principal,
      interestTxId: tx?.id,
      kind: input.kind,
      createdAt: now,
    }
    commit({
      ...d,
      transactions: tx ? [...d.transactions, tx] : d.transactions,
      loanPayments: [...d.loanPayments, payment],
    })
  },

  /** 납부 기록 삭제 — 함께 만든 이자 지출도 지운다 */
  deleteLoanPayment(id: string) {
    const d = state.data
    const p = d.loanPayments.find((x) => x.id === id)
    if (!p) return
    commit({
      ...d,
      loanPayments: d.loanPayments.filter((x) => x.id !== id),
      transactions: p.interestTxId ? d.transactions.filter((t) => t.id !== p.interestTxId) : d.transactions,
    })
  },

  resetAll() {
    if (countRecords(state.data)) set(`${AUTO_BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}-before-reset`, state.data).catch(() => {})
    commit(createInitialData())
  },
}

export function isLedgerData(value: unknown): value is LedgerData {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<LedgerData>
  return Array.isArray(v.transactions) && Array.isArray(v.categories)
}
