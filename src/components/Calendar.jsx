import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'

// Generic month calendar used by clients (slot picker) and the nailtech (bookings + schedule).
//  badge(dateStr)      -> small JSX shown under the day number
//  isDisabled(dateStr) -> true = greyed out and not tappable
//  weekBanner(dateStrs) -> text to write across that week (its days become faint + untappable), or null.
//                          Back-to-back weeks with the same text get ONE label centred across them.
export default function Calendar({ month, onMonth, selected, onSelect, badge, isDisabled, isSelected, dayClass, weekBanner }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  // group the weeks: consecutive weeks with the same banner become one block
  const blocks = []
  for (const wk of weeks) {
    const banner = weekBanner?.(wk.filter((d) => isSameMonth(d, month)).map((d) => format(d, 'yyyy-MM-dd'))) || null
    const last = blocks[blocks.length - 1]
    if (banner && last?.banner === banner) last.weeks.push(wk)
    else blocks.push({ banner, weeks: [wk] })
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => onMonth(addMonths(month, -1))} aria-label="Previous month" className="size-11 rounded-full text-xl hover:bg-cream/10">‹</button>
        <div className="font-display text-xl font-semibold">{format(month, 'MMMM yyyy')}</div>
        <button onClick={() => onMonth(addMonths(month, 1))} aria-label="Next month" className="size-11 rounded-full text-xl hover:bg-cream/10">›</button>
      </div>
      <div className="mb-2 grid grid-cols-7 text-center text-xs text-cream/50">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="flex flex-col gap-1.5">
        {blocks.map(({ banner, weeks: ws }) => (
          // back-to-back "Available soon" weeks share ONE label, centred across all of them
          <div key={format(ws[0][0], 'yyyy-MM-dd')} className="relative flex flex-col gap-1.5">
            {ws.map((wk) => (
              <div key={format(wk[0], 'yyyy-MM-dd')} className="grid grid-cols-7 gap-1.5">
                {wk.map((d) => {
                  const key = format(d, 'yyyy-MM-dd')
                  if (!isSameMonth(d, month)) return <div key={key} />
                  if (banner) return (
                    <div key={key} aria-hidden="true" className="flex aspect-square flex-col items-center justify-center text-sm text-cream/10">
                      <span className="font-semibold">{format(d, 'd')}</span><span className="h-3" />
                    </div>
                  )
                  const off = isDisabled?.(key)
                  const sel = isSelected ? isSelected(key) : selected === key
                  return (
                    <button
                      key={key}
                      disabled={off}
                      onClick={() => onSelect(key)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition
                        ${sel ? 'bg-cream text-ink' : off ? 'text-cream/25' : dayClass?.(key) || 'bg-cream/5 hover:bg-cream/15'}`}
                    >
                      <span className="font-semibold">{format(d, 'd')}</span>
                      <span className="h-3 text-[10px] leading-3">{badge?.(key, sel)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {banner && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="note">
                <span className="rounded-full border border-peach/70 bg-[#1e040c]/60 px-4 py-1 font-display text-[1.05rem] italic text-peach">{banner}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
