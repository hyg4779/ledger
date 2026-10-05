import { useEffect, useState, type ReactNode } from 'react'
import { ChartIcon, HomeIcon, LoanIcon, PlusIcon, RecordIcon, SettingsIcon } from './components/Icons'
import { LoanPaymentSheet } from './components/LoanPaymentSheet'
import { LoanSheet } from './components/LoanSheet'
import { TransactionSheet } from './components/TransactionSheet'
import { currentMonthKey, todayKey, type MonthKey } from './lib/dates'
import { loadLedger, useLedger } from './lib/store'
import type { Loan, Transaction } from './lib/types'
import { HomeScreen } from './screens/HomeScreen'
import { LoansScreen } from './screens/LoansScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'

type Tab = 'home' | 'records' | 'loans' | 'stats' | 'settings'

/** 열려 있는 입력 시트 */
type SheetState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; tx: Transaction }
  | { mode: 'loan'; loan: Loan | null }
  | { mode: 'loanPayment'; loan: Loan }

const TABS: [Tab, ReactNode, string][] = [
  ['home', <HomeIcon />, '홈'],
  ['records', <RecordIcon />, '기록'],
  ['loans', <LoanIcon />, '대출·이자'],
  ['stats', <ChartIcon />, '분석'],
  ['settings', <SettingsIcon />, '설정'],
]

export default function App() {
  const { data, loaded, saveError } = useLedger()
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState<MonthKey>(currentMonthKey())
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' })
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    loadLedger()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (data.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.theme)
  }, [data.theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  if (!loaded) return <div className="splash">불러오는 중…</div>

  // 보고 있는 달이 이번 달이면 오늘, 지난 달이면 그 달 1일을 기본 날짜로
  const defaultDate = month === currentMonthKey() ? todayKey() : `${month}-01`
  const showCategory = (id: string, m: MonthKey = month) => {
    setMonth(m)
    setCategoryFilter(id)
    setTab('records')
  }
  const openEdit = (tx: Transaction) => setSheet({ mode: 'edit', tx })

  return (
    <div className="app">
      {saveError && <div className="banner-error">{saveError}</div>}
      <main>
        {tab === 'home' && (
          <HomeScreen
            month={month}
            onMonthChange={setMonth}
            onShowCategory={(id) => showCategory(id)}
            onOpenRecords={() => {
              setCategoryFilter(null)
              setTab('records')
            }}
            onOpenSettings={() => setTab('settings')}
            onOpenLoans={() => setTab('loans')}
            onEdit={openEdit}
          />
        )}
        {tab === 'records' && (
          <RecordsScreen
            month={month}
            onMonthChange={setMonth}
            onEdit={openEdit}
            categoryFilter={categoryFilter}
            onClearFilter={() => setCategoryFilter(null)}
          />
        )}
        {tab === 'loans' && (
          <LoansScreen
            month={month}
            onMonthChange={setMonth}
            onAddLoan={() => setSheet({ mode: 'loan', loan: null })}
            onEditLoan={(loan) => setSheet({ mode: 'loan', loan })}
            onPay={(loan) => setSheet({ mode: 'loanPayment', loan })}
          />
        )}
        {tab === 'stats' && <StatsScreen month={month} onMonthChange={setMonth} onShowCategory={showCategory} />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      {(tab === 'home' || tab === 'records') && (
        <button type="button" className="fab" onClick={() => setSheet({ mode: 'new' })}>
          <PlusIcon />
          기록하기
        </button>
      )}

      <nav className="tabbar">
        {TABS.map(([t, icon, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'on' : ''}
            onClick={() => {
              if (t === 'records' && tab !== 'records') setCategoryFilter(null)
              setTab(t)
            }}
            aria-current={tab === t}
          >
            <span className="tab-icon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {sheet.mode === 'loan' && <LoanSheet key={sheet.loan?.id ?? 'new-loan'} editing={sheet.loan} onClose={() => setSheet({ mode: 'closed' })} />}
      {sheet.mode === 'loanPayment' && <LoanPaymentSheet loan={sheet.loan} onClose={() => setSheet({ mode: 'closed' })} />}
      {(sheet.mode === 'new' || sheet.mode === 'edit') && (
        <TransactionSheet
          key={sheet.mode === 'edit' ? sheet.tx.id : 'new'}
          editing={sheet.mode === 'edit' ? sheet.tx : null}
          defaultDate={defaultDate}
          onClose={() => setSheet({ mode: 'closed' })}
        />
      )}
    </div>
  )
}
