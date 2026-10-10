import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, HISTORY_FILTERS } from '../../lib/config'
import { fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Card, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import BookingRow from '../../components/BookingRow'
import Phrases from '../../components/Phrases'

const SHOWN_IN_DAY = [...ACTIVE, 'completed', 'no_show']
const NEEDS_ACTION = ['awaiting_payment', 'payment_submitted']

export default function Dashboard() {
  const [rows, setRows] = useState(null)
  const [slots, setSlots] = useState([])
  const [view, setView] = useState('calendar')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(ymd(new Date()))

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const [b, s] = await Promise.all([
      supabase.from('bookings').select('*').order('slot_date').order('slot_time'),
      supabase.from('schedule_slots').select('slot_date,slot_time,is_open').order('slot_date').order('slot_time'),
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

  const upcoming = useMemo(() => (rows || []).filter((r) => ACTIVE.includes(r.status) && r.slot_date >= today), [rows, today])

  const history = useMemo(() => {
    const st = HISTORY_FILTERS.find((f) => f[0] === filter)?.[2]
    const needle = q.trim().toLowerCase().replace(/^@/, '')
    const last = (r) => r.updated_at || r.created_at
    return [...(rows || [])].sort((a, b) => (last(a) < last(b) ? 1 : -1)).filter((r) =>
      (!st || st.includes(r.status)) &&
      (!needle || [r.full_name, r.instagram, r.phone, r.code].some((v) => v.toLowerCase().includes(needle))))
  }, [rows, filter, q])
  const countFor = (key) => {
    const st = HISTORY_FILTERS.find((f) => f[0] === key)?.[2]
    return (rows || []).filter((r) => !st || st.includes(r.status)).length
  }

  const dayTimes = useMemo(() => {
    const t = new Set(slots.filter((s) => s.slot_date === day && s.is_open !== false).map((s) => s.slot_time))
    ;(byDay[day] || []).forEach((b) => t.add(b.slot_time))
    return [...t].sort()
  }, [slots, byDay, day])

  if (!rows) return <p className="text-center text-cream/60">Loading bookings…</p>

  const seg = (on) => `min-h-11 flex-1 rounded-lg text-sm font-semibold ${on ? 'bg-cream text-ink' : 'text-cream/70'}`
  return (
    <div className="space-y-4">
      <Phrases />
      <button onClick={() => { setView('history'); setFilter('payment_submitted') }}
        className={`w-full rounded-2xl border p-4 text-left ${action.length ? 'border-peach/50 bg-peach/10' : 'border-cream/20 bg-plum/55'}`}>
        <div className="text-2xl font-bold">{action.length}</div>
        <div className="text-sm text-cream/80">{action.length ? 'booking(s) need your attention (tap to view)' : 'Nothing needs your attention 🎉'}</div>
      </button>

      <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
        <button className={seg(view === 'calendar')} onClick={() => setView('calendar')}>Calendar</button>
        <button className={seg(view === 'upcoming')} onClick={() => setView('upcoming')}>Upcoming</button>
        <button className={seg(view === 'history')} onClick={() => setView('history')}>History</button>
      </div>

      {view === 'calendar' && (
        <>
          <Card>
            <Calendar month={month} onMonth={setMonth} selected={day} onSelect={setDay}
              badge={(k, sel) => {
                const n = (byDay[k] || []).length
                if (!n) return null
                const hot = (byDay[k] || []).some((r) => NEEDS_ACTION.includes(r.status))
                return <span className={sel ? 'text-ink' : hot ? 'text-amber-200' : 'text-rose'}>● {n}</span>
              }} />
          </Card>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-semibold">{fmtDateLong(day)}</h2>
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

      {view === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 && <p className="py-6 text-center text-sm text-cream/60">No upcoming bookings.</p>}
          {upcoming.map((b) => <BookingRow key={b.id} b={b} showDate onExpire={load} />)}
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-3">
          <input className={inputCls} placeholder="Search name, @instagram, phone or code" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {HISTORY_FILTERS.map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${filter === key ? 'border-cream bg-cream text-ink' : 'border-cream/25 text-cream/80'}`}>
                {label} <span className="opacity-70">{countFor(key)}</span>
              </button>
            ))}
          </div>
          {history.length === 0 && <p className="py-6 text-center text-sm text-cream/60">Nothing here.</p>}
          {history.map((b) => <BookingRow key={b.id} b={b} showDate onExpire={load} />)}
        </div>
      )}
    </div>
  )
}
