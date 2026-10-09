import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE } from '../../lib/config'
import { fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Card } from '../../components/ui'
import Calendar from '../../components/Calendar'
import BookingRow from '../../components/BookingRow'

const SHOWN_IN_DAY = [...ACTIVE, 'completed', 'no_show']
const NEEDS_ACTION = ['awaiting_payment', 'payment_submitted']

export default function Dashboard() {
  const [rows, setRows] = useState(null)
  const [slots, setSlots] = useState([])
  const [view, setView] = useState('calendar')
  const [filter, setFilter] = useState('action')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(ymd(new Date()))

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const [b, s] = await Promise.all([
      supabase.from('bookings').select('*').order('slot_date').order('slot_time'),
      supabase.from('schedule_slots').select('slot_date,slot_time').order('slot_date').order('slot_time'),
    ])
    setRows(b.data || []); setSlots(s.data || [])
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  const today = ymd(new Date())
  const action = (rows || []).filter((r) => NEEDS_ACTION.includes(r.status))
  const byDay = useMemo(() => {
    const m = {}
    ;(rows || []).filter((r) => SHOWN_IN_DAY.includes(r.status)).forEach((r) => (m[r.slot_date] ||= []).push(r))
    return m
  }, [rows])

  const list = useMemo(() => {
    const all = rows || []
    if (filter === 'action') return all.filter((r) => NEEDS_ACTION.includes(r.status))
    if (filter === 'upcoming') return all.filter((r) => ACTIVE.includes(r.status) && r.slot_date >= today)
    return [...all].reverse()
  }, [rows, filter, today])

  // Day timeline: every open slot + any booked time
  const dayTimes = useMemo(() => {
    const t = new Set(slots.filter((s) => s.slot_date === day).map((s) => s.slot_time))
    ;(byDay[day] || []).forEach((b) => t.add(b.slot_time))
    return [...t].sort()
  }, [slots, byDay, day])

  if (!rows) return <p className="text-center text-cream/60">Loading bookings…</p>

  const seg = (on) => `min-h-11 flex-1 rounded-lg text-sm font-semibold ${on ? 'bg-rose text-ink' : 'text-cream/70'}`
  return (
    <div className="space-y-4">
      <button onClick={() => { setView('list'); setFilter('action') }}
        className={`w-full rounded-2xl border p-4 text-left ${action.length ? 'border-amber-300/50 bg-amber-400/10' : 'border-cream/10 bg-wine/60'}`}>
        <div className="text-2xl font-bold">{action.length}</div>
        <div className="text-sm text-cream/80">{action.length ? 'booking(s) need your attention (tap to view)' : 'Nothing needs your attention 🎉'}</div>
      </button>

      <div className="flex gap-1 rounded-xl bg-ink/60 p-1">
        <button className={seg(view === 'calendar')} onClick={() => setView('calendar')}>Calendar</button>
        <button className={seg(view === 'list')} onClick={() => setView('list')}>All bookings</button>
      </div>

      {view === 'calendar' && (
        <>
          <Card>
            <Calendar month={month} onMonth={setMonth} selected={day} onSelect={setDay}
              badge={(k, sel) => {
                const n = (byDay[k] || []).length
                if (!n) return null
                const hot = (byDay[k] || []).some((r) => NEEDS_ACTION.includes(r.status))
                return <span className={sel ? 'text-ink' : hot ? 'text-amber-300' : 'text-rose'}>● {n}</span>
              }} />
          </Card>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold">{fmtDateLong(day)}</h2>
            {dayTimes.length === 0 && <p className="text-sm text-cream/60">No slots open on this day.</p>}
            {dayTimes.map((t) => {
              const bs = (byDay[day] || []).filter((b) => b.slot_time === t)
              return bs.length
                ? bs.map((b) => <BookingRow key={b.id} b={b} onExpire={load} />)
                : <div key={t} className="rounded-xl border border-dashed border-cream/15 p-3 text-sm text-cream/50">{fmtTime(t)} · Open, no booking</div>
            })}
          </div>
        </>
      )}

      {view === 'list' && (
        <div className="space-y-3">
          <div className="flex gap-1 rounded-xl bg-ink/60 p-1">
            <button className={seg(filter === 'action')} onClick={() => setFilter('action')}>Needs action</button>
            <button className={seg(filter === 'upcoming')} onClick={() => setFilter('upcoming')}>Upcoming</button>
            <button className={seg(filter === 'all')} onClick={() => setFilter('all')}>All</button>
          </div>
          {list.length === 0 && <p className="py-6 text-center text-sm text-cream/60">Nothing here.</p>}
          {list.map((b) => <BookingRow key={b.id} b={b} showDate onExpire={load} />)}
        </div>
      )}
    </div>
  )
}
