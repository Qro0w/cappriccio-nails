import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth, startOfWeek, differenceInCalendarWeeks } from 'date-fns'
import { supabase } from '../lib/supabase'
import { fmtTime, slotStart, ymd } from '../lib/format'
import { drawStory, loadStoryAssets } from '../lib/storyImage'
import { Btn } from './ui'

const TAKEN = ['awaiting_payment', 'payment_submitted', 'confirmed', 'completed', 'no_show']
const hhmm = (t) => t.slice(0, 5)

// Pop-up on the Schedule page: a live calendar of every time slot (open / booked / closed)
// that can be saved as a 1080×1920 PNG for her Instagram story.
export default function SlotsOverview({ open, onClose, startMonth }) {
  const [mode, setMode] = useState('month') // 'month' | 'two'
  const [month, setMonth] = useState(startMonth || startOfMonth(new Date()))
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const canvas = useRef(null)

  const load = useCallback(async () => {
    const [s, b, m, d] = await Promise.all([
      supabase.from('schedule_slots').select('slot_date,slot_time,is_open'),
      supabase.from('bookings').select('slot_date,slot_time,status').in('status', TAKEN),
      supabase.from('schedule_months').select('month,visible'),
      supabase.from('schedule_days').select('day,visible'),
    ])
    if (s.error || b.error) { setErr('Could not load the schedule. Please try again.'); return }
    setErr('')
    setData({ slots: s.data || [], booked: (b.data || []).filter((x) => TAKEN.includes(x.status)), months: m.data || [], days: d.data || [] })
  }, [])

  useEffect(() => {
    if (!open) return
    setMonth(startMonth || startOfMonth(new Date()))
    load()
    const id = setInterval(load, 30000) // stays up to date while open
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => { clearInterval(id); window.removeEventListener('keydown', esc) }
  }, [open]) // eslint-disable-line

  // Build what the image shows
  const story = (() => {
    if (!data) return null
    const now = Date.now()
    const shown = (k) => {
      const mv = data.months.find((x) => x.month === ymd(startOfMonth(parseISO(k))))?.visible
      return !!mv && data.days.find((x) => x.day === k)?.visible !== false
    }
    const openTimes = (k) => data.slots.filter((x) => x.slot_date === k && x.is_open !== false).map((x) => hhmm(x.slot_time)).sort()
    // hidden day/month that still has upcoming times = "Available soon" (same rule as the client calendar)
    const soonOn = (k) => !shown(k) && openTimes(k).some((t) => slotStart(k, t + ':00') >= now)
    const timesOn = (k) => {
      const ts = openTimes(k)
      if (!ts.length || !shown(k)) return null
      return ts.map((t) => ({
        label: fmtTime(t + ':00'),
        booked: data.booked.some((x) => x.slot_date === k && hhmm(x.slot_time) === t) || slotStart(k, t + ':00') < now,
      }))
    }
    let dates, title, subtitle, weekStart
    if (mode === 'month') {
      dates = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
      title = format(month, 'MMMM'); subtitle = `${format(month, 'yyyy')} · SLOTS`
      weekStart = startOfWeek(startOfMonth(month))
    } else {
      const from = new Date(); from.setHours(0, 0, 0, 0)
      dates = eachDayOfInterval({ start: from, end: addDays(from, 13) })
      const a = dates[0], z = dates[13]
      title = `${format(a, 'MMM d')} – ${format(z, a.getMonth() === z.getMonth() ? 'd' : 'MMM d')}`
      subtitle = 'OPEN SLOTS'
      weekStart = startOfWeek(a)
    }
    const days = dates.map((dt) => ({ key: ymd(dt), d: dt.getDate(), col: getDay(dt), row: differenceInCalendarWeeks(dt, weekStart), times: timesOn(ymd(dt)), soon: soonOn(ymd(dt)) }))
    const rows = Math.max(...days.map((x) => x.row)) + 1
    // a week is "Available soon" when it has hidden upcoming days and nothing showing;
    // a whole hidden month (that already has times) is "Available soon" from top to bottom
    const monthSoon = mode === 'month' && !data.months.find((x) => x.month === ymd(startOfMonth(month)))?.visible && days.some((x) => x.soon)
    const soonRow = Array.from({ length: rows }, (_, r) => {
      const inRow = days.filter((x) => x.row === r)
      return monthSoon || (inRow.some((x) => x.soon) && !inRow.some((x) => x.times))
    })
    const banners = [] // back-to-back soon weeks share one label: [firstRow, lastRow]
    soonRow.forEach((on, r) => { if (!on) return; const last = banners[banners.length - 1]; if (last && last[1] === r - 1) last[1] = r; else banners.push([r, r]) })
    return { title, subtitle, days, rows, banners, footer: `Book at ${window.location.host} · @cappriccio.nails` }
  })()

  const key = story ? JSON.stringify(story) : ''
  useEffect(() => {
    if (!open || !story || !canvas.current) return
    let alive = true
    loadStoryAssets().then((assets) => { if (alive && canvas.current) drawStory(canvas.current, story, assets) })
    return () => { alive = false }
  }, [key, open]) // eslint-disable-line

  async function download() {
    if (!canvas.current) return
    setBusy(true)
    const name = mode === 'month' ? `cappriccio-slots-${format(month, 'yyyy-MM')}.png` : `cappriccio-slots-${ymd(new Date())}-2weeks.png`
    const blob = await new Promise((r) => canvas.current.toBlob(r, 'image/png'))
    setBusy(false)
    if (!blob) return setErr('Could not make the image. Please try again.')
    const file = new File([blob], name, { type: 'image/png' })
    const phone = window.matchMedia?.('(pointer: coarse)').matches
    if (phone && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return } catch { /* cancelled: fall through to download */ return }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  if (!open) return null
  const seg = (on) => `min-h-10 flex-1 rounded-xl text-sm font-semibold ${on ? 'bg-cream text-ink' : 'text-cream/70'}`
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label="Slots overview" onClick={(e) => e.stopPropagation()}
        className="rise-in flex max-h-[94vh] w-full max-w-md flex-col gap-3 overflow-y-auto overscroll-contain rounded-[28px] border border-cream/15 bg-[#1a050b] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Slots overview</h3>
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full text-cream/70 hover:bg-cream/10">✕</button>
        </div>
        {mode === 'month' && (
          <div className="flex items-center justify-between">
            <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className="flex size-10 items-center justify-center rounded-full bg-cream/5 text-xl">‹</button>
            <div className="font-display text-lg">{format(month, 'MMMM yyyy')}</div>
            <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="flex size-10 items-center justify-center rounded-full bg-cream/5 text-xl">›</button>
          </div>
        )}
        <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
          <button className={seg(mode === 'month')} onClick={() => setMode('month')}>Whole month</button>
          <button className={seg(mode === 'two')} onClick={() => setMode('two')}>Next 2 weeks</button>
        </div>
        {err && <p className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</p>}
        <div className="relative w-full shrink-0 overflow-hidden rounded-2xl" style={{ aspectRatio: '9 / 16' }}>
          {!data && <div className="skeleton absolute inset-0" />}
          <canvas ref={canvas} className="block h-full w-full" />
        </div>
        <p className="text-center text-xs text-cream/55">Updates live as clients book. Fully hidden weeks show “Available soon”; other hidden days and days off show as CLOSED; times already past are crossed out.</p>
        {/* Always visible at the bottom of the pop-up, even while scrolling the preview */}
        <div className="sticky -bottom-4 -mx-4 -mb-4 mt-auto shrink-0 border-t border-cream/10 bg-[#1a050b]/95 px-4 pb-4 pt-3 backdrop-blur">
          <Btn className="w-full gap-2" disabled={!data || busy} onClick={download}>⤓ Download for story (PNG)</Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
