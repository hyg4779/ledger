import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import { createInitialData, DEFAULT_CATEGORIES } from './defaults'
import { LOAN_INTEREST_CATEGORY } from './loans'
import type { Asset, AssetSnapshot, Category, LedgerData, Loan, LoanPayment, ThemeMode, Transaction } from './types'

const STORAGE_KEY = 'ledger-data-v1'

interface StoreState {
  data: LedgerData
  loaded: boolean
  /** 마지막 저장 실패 메시지. 성공하면 null로 돌아간다. */
  saveError: string | null
}

let state: StoreState = { data: createInitialData(), loaded: false, saveError: null }
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

export async function loadLedger(): Promise<void> {
  try {
    const saved = await get<LedgerData>(STORAGE_KEY)
    if (saved) state = { ...state, data: normalize(saved) }
  } catch (e) {
    state = { ...state, saveError: `저장소를 열 수 없어요: ${String(e)}` }
  }
  state = { ...state, loaded: true }
  emit()
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
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    assetSnapshots: Array.isArray(raw.assetSnapshots) ? raw.assetSnapshots : [],
  }
}

function commit(data: LedgerData) {
  state = { ...state, data }
  emit()
  set(STORAGE_KEY, data).then(
    () => {
      if (state.saveError) {
        state = { ...state, saveError: null }
        emit()
      }
    },
    (e) => {
      state = { ...state, saveError: `저장에 실패했어요: ${String(e)}` }
      emit()
    },
  )
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
    commit(normalize(data))
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
    commit(createInitialData())
  },
}

export function isLedgerData(value: unknown): value is LedgerData {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<LedgerData>
  return Array.isArray(v.transactions) && Array.isArray(v.categories)
}
