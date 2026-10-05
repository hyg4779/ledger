import { ChevronLeft, ChevronRight } from './Icons'

interface Props {
  label: string
  onPrev: () => void
  onNext: () => void
  /** 미래로는 넘어가지 않게 막을 때 */
  nextDisabled?: boolean
  onLabelClick?: () => void
}

export function MonthNav({ label, onPrev, onNext, nextDisabled, onLabelClick }: Props) {
  return (
    <div className="month-nav">
      <button type="button" className="month-nav-arrow" onClick={onPrev} aria-label="이전">
        <ChevronLeft />
      </button>
      <button type="button" className="month-nav-label" onClick={onLabelClick}>
        {label}
      </button>
      <button type="button" className="month-nav-arrow" onClick={onNext} disabled={nextDisabled} aria-label="다음">
        <ChevronRight />
      </button>
    </div>
  )
}
