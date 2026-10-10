import { todayKey } from './dates'
import type { LedgerData } from './types'

/**
 * 파일을 내보낸다. iOS 홈 화면 앱에서는 <a download>가 동작하지 않는 경우가 있어
 * 가능하면 공유 시트(파일 앱에 저장, 카톡·메일 전송 등)를 쓰고, 안 되면 다운로드로 대신한다.
 */
async function shareOrDownload(filename: string, mime: string, content: string): Promise<boolean> {
  const blob = new Blob([content], { type: mime })
  const file = new File([blob], filename, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (e) {
      // 사용자가 공유 시트를 닫은 경우는 그대로 끝낸다.
      if ((e as DOMException).name === 'AbortError') return false
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

export function exportJson(data: LedgerData) {
  return shareOrDownload(`가계부-백업-${todayKey()}.json`, 'application/json', JSON.stringify(data, null, 1))
}

export function exportCsv(data: LedgerData) {
  const catName = new Map(data.categories.map((c) => [c.id, c.name]))
  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const rows = [...data.transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((t) =>
      [t.date, t.type === 'income' ? '수입' : '지출', catName.get(t.categoryId) ?? '', String(t.amount), t.memo]
        .map(escape)
        .join(','),
    )
  // 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다.
  const csv = '﻿' + ['날짜,구분,카테고리,금액,메모', ...rows].join('\r\n')
  return shareOrDownload(`가계부-${todayKey()}.csv`, 'text/csv', csv)
}

export function readJsonFile(file: File): Promise<unknown> {
  return file.text().then((text) => JSON.parse(text))
}
