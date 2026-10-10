import { useEffect, useRef, useState, type ReactNode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { AssetSheet, AssetValueSheet, BulkAssetSheet } from './components/AssetSheets'
import { AssetIcon, ChartIcon, HomeIcon, LoanIcon, PlusIcon, RecordIcon, SettingsIcon } from './components/Icons'
import { LoanPaymentSheet } from './components/LoanPaymentSheet'
import { LoanSheet } from './components/LoanSheet'
import { TransactionSheet } from './components/TransactionSheet'
import { currentMonthKey, todayKey, type MonthKey } from './lib/dates'
import { isIOS, isStandalone } from './lib/platform'
import { actions, countRecords, loadLedger, useLedger } from './lib/store'
import type { Asset, Loan, Transaction } from './lib/types'
import { AssetsScreen } from './screens/AssetsScreen'
import { HomeScreen } from './screens/HomeScreen'
import { LoansScreen } from './screens/LoansScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'

type Tab = 'home' | 'records' | 'assets' | 'loans' | 'stats' | 'settings'

/** 열려 있는 입력 시트 */
type SheetState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; tx: Transaction }
  | { mode: 'loan'; loan: Loan | null }
  | { mode: 'loanPayment'; loan: Loan }
  | { mode: 'asset'; asset: Asset | null }
  | { mode: 'assetValue'; asset: Asset }
  | { mode: 'assetBulk' }

const TABS: [Tab, ReactNode, string][] = [
  ['home', <HomeIcon />, '홈'],
  ['records', <RecordIcon />, '기록'],
  ['assets', <AssetIcon />, '자산'],
  ['loans', <LoanIcon />, '대출·이자'],
  ['stats', <ChartIcon />, '분석'],
  ['settings', <SettingsIcon />, '설정'],
]

export default function App() {
  const { data, loaded, saveError, recoveredFrom } = useLedger()
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState<MonthKey>(currentMonthKey())
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' })
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    loadLedger()
    updateSW.current = registerSW({ onNeedRefresh: () => setNeedRefresh(true) })
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
      {needRefresh && (
        <div className="banner-info">
          <span>새 버전이 준비됐어요. 기록은 그대로 유지돼요.</span>
          <button type="button" className="mini-btn" onClick={() => updateSW.current?.(true)}>
            업데이트
          </button>
        </div>
      )}
      {recoveredFrom && (
        <div className="banner-info">
          <span>기본 저장소가 비어 있어 {recoveredFrom}에서 기록을 되살렸어요.</span>
          <button type="button" className="mini-btn ghost" onClick={() => actions.dismissRecovered()}>
            확인
          </button>
        </div>
      )}
      {tab === 'home' && <SafetyNudge onOpenSettings={() => setTab('settings')} />}
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
            onOpenAssets={() => setTab('assets')}
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
        {tab === 'assets' && (
          <AssetsScreen
            onAddAsset={() => setSheet({ mode: 'asset', asset: null })}
            onOpenAsset={(asset) => setSheet({ mode: 'assetValue', asset })}
            onBulkUpdate={() => setSheet({ mode: 'assetBulk' })}
            onOpenLoans={() => setTab('loans')}
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
      {sheet.mode === 'asset' && <AssetSheet key={sheet.asset?.id ?? 'new-asset'} editing={sheet.asset} onClose={() => setSheet({ mode: 'closed' })} />}
      {sheet.mode === 'assetValue' && (
        <AssetValueSheet
          key={sheet.asset.id}
          asset={sheet.asset}
          onClose={() => setSheet({ mode: 'closed' })}
          onEditInfo={() => setSheet({ mode: 'asset', asset: sheet.asset })}
        />
      )}
      {sheet.mode === 'assetBulk' && <BulkAssetSheet onClose={() => setSheet({ mode: 'closed' })} />}
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

/** 데이터 손실 위험 안내: 아이폰 브라우저 탭에서 쓰는 경우, 백업 파일이 오래된 경우 */
function SafetyNudge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data } = useLedger()
  const records = countRecords(data)
  if (isIOS() && !isStandalone()) {
    return (
      <div className="banner-warn">
        <span>
          지금은 Safari 탭이에요. <b>홈 화면 앱과 기록이 따로 저장</b>되고, 탭은 오래 안 쓰면 기록이 지워질 수 있어요. 공유 → 홈 화면에 추가 후 그 아이콘으로
          써 주세요.
        </span>
      </div>
    )
  }
  const days = data.lastExportAt ? (Date.now() - data.lastExportAt) / 86_400_000 : Infinity
  if (records >= 10 && days > 30) {
    return (
      <button type="button" className="banner-warn" onClick={onOpenSettings}>
        <span>
          {data.lastExportAt ? `백업 파일을 저장한 지 ${Math.floor(days)}일 지났어요.` : '아직 백업 파일을 저장한 적이 없어요.'} 폰을 바꾸거나 앱을 지우면 기록이
          사라지니 설정에서 백업해 주세요 ›
        </span>
      </button>
    )
  }
  return null
}
