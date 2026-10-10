import type { SVGProps } from 'react'

/** 1.8px 선 아이콘 모음 — 색은 currentColor를 따른다 */
function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

export const HomeIcon = () => (
  <Svg>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Svg>
)

export const RecordIcon = () => (
  <Svg>
    <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </Svg>
)

export const AssetIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v8l5.7 5.7" />
  </Svg>
)

export const LoanIcon = () => (
  <Svg>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M3.5 10h17M7 14.5h4" />
  </Svg>
)

export const ChartIcon = () => (
  <Svg>
    <path d="M6 19v-6M12 19V6M18 19v-9" />
  </Svg>
)

export const SettingsIcon = () => (
  <Svg>
    <path d="M4 7.5h16M4 16.5h16" />
    <circle cx="9" cy="7.5" r="2.3" fill="var(--surface)" />
    <circle cx="15" cy="16.5" r="2.3" fill="var(--surface)" />
  </Svg>
)

export const PlusIcon = () => (
  <Svg strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const ChevronLeft = () => (
  <Svg width={20} height={20}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
)

export const ChevronRight = () => (
  <Svg width={20} height={20}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
)

export const InfoIcon = () => (
  <Svg width={18} height={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8v.2" />
  </Svg>
)

export const SearchIcon = () => (
  <Svg width={18} height={18}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
)
