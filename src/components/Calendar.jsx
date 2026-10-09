import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'

// Generic month calendar used by clients (slot picker) and the nailtech (bookings + schedule).
//  badge(dateStr)      -> small JSX shown under the day number
//  isDisabled(dateStr) -> true = greyed out and not tappable
export default function Calendar({ month, onMonth, selected, onSelect, badge, isDisabled }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => onMonth(addMonths(month, -1))} aria-label="Previous month" className="size-11 rounded-full text-xl hover:bg-cream/10">‹</button>
        <div className="font-display text-xl font-bold">{format(month, 'MMMM yyyy')}</div>
        <button onClick={() => onMonth(addMonths(month, 1))} aria-label="Next month" className="size-11 rounded-full text-xl hover:bg-cream/10">›</button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-cream/50">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          if (!isSameMonth(d, month)) return <div key={key} />
          const off = isDisabled?.(key)
          const sel = selected === key
          return (
            <button
              key={key}
              disabled={off}
              onClick={() => onSelect(key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition
                ${sel ? 'bg-rose text-ink' : off ? 'text-cream/25' : 'bg-cream/5 hover:bg-cream/15'}`}
            >
              <span className="font-semibold">{format(d, 'd')}</span>
              <span className="h-3 text-[10px] leading-3">{badge?.(key, sel)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
