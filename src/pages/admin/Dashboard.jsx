import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { ACTIVE, ALL_FILTERS, HISTORY_FILTERS, REMOVALS, SERVICES } from '../../lib/config'
import { balanceOf, fmtDateLong, fmtTime, peso, slotStart, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, StatusBadge, inputCls } from '../../components/ui'
import { EmptyState, Skeleton } from '../../components/Feedback'
import { IgIcon } from '../../components/Icons'
import Calendar from '../../components/Calendar'
import BookingRow from '../../components/BookingRow'
import Phrases from '../../components/Phrases'

const SHOWN_IN_DAY = [...ACTIVE, 'completed', 'no_show']
const NEEDS_ACTION = ['awaiting_payment', 'payment_submitted']
const byDateTime = (a, b) => (a.slot_date + a.slot_time < b.slot_date + b.slot_time ? -1 : 1)
const lastActivity = (r) => r.updated_at || r.created_at

// One appointment card for the selected day (quick Call / DM / Done / No-show)
function DayCard({ b, next, onQuick, i }) {
  const m = balanceOf(b.final_price, b.estimated_price, b.dp_amount)
  const ig = b.instagram && b.instagram !== '-' ? b.instagram.replace('@', '') : null
  const phone = b.phone && b.phone !== '-' ? b.phone : null
  return (
    <div className={`anim-in space-y-2 rounded-3xl border p-4 ${next ? 'border-rose/60 bg-rose/10' : 'border-cream/15 bg-plum/55'}`} style={{ animationDelay: `${i * 60}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {next && <div className="text-xs font-semibold uppercase tracking-widest text-rose">Up next</div>}
          <div className="font-display text-2xl font-semibold">{fmtTime(b.slot_time)}</div>
          <Link to={`/admin/booking/${b.id}`} className="text-lg font-semibold underline decoration-cream/30 underline-offset-4">{b.full_name}</Link>
          <div className="text-xs text-cream/70">{SERVICES[b.service].short}{b.length ? ` · ${b.length}` : ''} · Tier {b.tier} · {REMOVALS[b.removal].label}{b.intensive ? ' · Intensive' : ''}</div>
        </div>
        <StatusBadge status={b.status} />
      </div>
      {['payment_submitted', 'confirmed', 'completed'].includes(b.status) && (
        <div className="flex justify-between rounded-2xl bg-ink/40 px-3 py-2 text-sm">
          <span className="text-cream/70">{b.balance_paid != null ? 'Balance' : 'Left to pay'}</span>
          <span className="font-semibold text-rose">{b.balance_paid != null ? 'Paid ✓' : peso(m.left)}</span>
        </div>
      )}
      {ACTIVE.includes(b.status) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {phone && <Btn as="a" variant="ghost" href={`tel:${phone}`} className="!min-h-10">Call</Btn>}
          {ig && <Btn as="a" variant="ghost" href={`https://ig.me/m/${ig}`} target="_blank" rel="noreferrer" className="!min-h-10 gap-1.5"><IgIcon />DM</Btn>}
          {b.status === 'confirmed' && <>
            <Btn className="!min-h-10" onClick={() => onQuick({ b, status: 'completed' })}>✓ Done</Btn>
            <Btn variant="ghost" className="!min-h-10" onClick={() => onQuick({ b, status: 'no_show' })}>No-show</Btn>
          </>}
        </div>
      )}
    </div>
  )
}

function FilterChips({ filters, value, onChange, count }) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${value === key ? 'border-cream bg-cream text-ink' : 'border-cream/25 text-cream/80'}`}>
          {label} <span className="opacity-70">{count(key)}</span>
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [rows, setRows] = useState(null)
  const [slots, setSlots] = useState([])
  const [tab, setTab] = useState('upcoming') // upcoming | all | history
  const [quick, setQuick] = useState(null) // { b, status }
  const [qBusy, setQBusy] = useState(false)
  const [allFilter, setAllFilter] = useState('all')
  const [histFilter, setHistFilter] = useState('all')
  const [q, setQ] = useState('')
  // Always opens on today; leaving the page and coming back resets to today.
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [day, setDay] = useState(() => ymd(new Date()))
  const [checkHours, setCheckHours] = useState(12)
  const dayRef = useRef(null)

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const [b, s] = await Promise.all([
      supabase.from('bookings').select('*').order('slot_date').order('slot_time'),
      supabase.from('schedule_slots').select('slot_date,slot_time,is_open').order('slot_date').order('slot_time'),
    ])
    setRows(b.data || []); setSlots(s.data || [])
    const st = await supabase.from('settings').select('value').eq('key', 'check_reminder_hours').maybeSingle()
    if (st.data?.value) setCheckHours(Number(st.data.value) || 12)
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  const today = ymd(new Date())
  const all = useMemo(() => rows || [], [rows])
  const action = all.filter((r) => NEEDS_ACTION.includes(r.status))
  const toCheck = all.filter((r) => r.status === 'payment_submitted')
  const overdue = toCheck.filter((r) => r.receipt_uploaded_at && (Date.now() - new Date(r.receipt_uploaded_at)) / 36e5 >= checkHours)

  const byDay = useMemo(() => {
    const m = {}
    all.filter((r) => SHOWN_IN_DAY.includes(r.status)).forEach((r) => (m[r.slot_date] ||= []).push(r))
    return m
  }, [all])

  const matches = useCallback((r) => {
    const needle = q.trim().toLowerCase().replace(/^@/, '')
    return !needle || [r.full_name, r.instagram, r.phone, r.code].some((v) => (v || '').toLowerCase().includes(needle))
  }, [q])
  const upcoming = useMemo(() => all.filter((r) => ACTIVE.includes(r.status) && r.slot_date >= today).sort(byDateTime), [all, today])
  const statusesOf = (filters, key) => filters.find((f) => f[0] === key)?.[2]
  const allList = useMemo(() => {
    const st = statusesOf(ALL_FILTERS, allFilter)
    return all.filter((r) => (!st || st.includes(r.status)) && matches(r)).sort(byDateTime)
  }, [all, allFilter, matches])
  const histList = useMemo(() => {
    const st = statusesOf(HISTORY_FILTERS, histFilter)
    return all.filter((r) => st.includes(r.status) && matches(r)).sort((a, b) => (lastActivity(a) < lastActivity(b) ? 1 : -1))
  }, [all, histFilter, matches])
  const countIn = (filters) => (key) => { const st = statusesOf(filters, key); return all.filter((r) => !st || st.includes(r.status)).length }

  if (!rows) return <Skeleton lines={5} />

  // Selected day: bookings + open times with no booking
  const dayBookings = (byDay[day] || []).slice().sort(byDateTime)
  const dayOpen = slots.filter((s) => s.slot_date === day && s.is_open !== false && !dayBookings.some((b) => b.slot_time === s.slot_time))
  const dayItems = [...dayBookings.map((b) => ({ t: b.slot_time, b })), ...dayOpen.map((s) => ({ t: s.slot_time }))].sort((x, y) => (x.t < y.t ? -1 : 1))
  const nextId = day === today ? dayBookings.find((b) => ACTIVE.includes(b.status) && slotStart(b.slot_date, b.slot_time) > Date.now() - 2 * 36e5)?.id : null
  const goToday = () => { setDay(today); setMonth(startOfMonth(new Date())) }
  // Tapping a date shows that day's bookings (above the calendar on phones), so bring them into view
  const pickDay = (k) => { setDay(k); requestAnimationFrame(() => dayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }

  async function runQuick() {
    setQBusy(true)
    await supabase.from('bookings').update({ status: quick.status }).eq('id', quick.b.id)
    setQBusy(false); setQuick(null); load()
  }

  const seg = (on) => `min-h-11 flex-1 rounded-lg text-sm font-semibold ${on ? 'bg-cream text-ink' : 'text-cream/70'}`
  return (
    <div className="space-y-4">
      <Phrases />
      <button onClick={() => { setTab('all'); setAllFilter('payment_submitted') }}
        className={`w-full rounded-2xl border p-4 text-left ${toCheck.length ? 'border-peach/50 bg-peach/10' : 'border-cream/20 bg-plum/55'}`}>
        <div className="text-2xl font-bold">{toCheck.length}</div>
        <div className="text-sm text-cream/80">{toCheck.length ? `receipt(s) to check (tap to view)` : action.length ? `Nothing to check · ${action.length} waiting for payment` : 'Nothing needs your attention 🎉'}</div>
        {overdue.length > 0 && <div className="mt-1 text-sm font-semibold text-peach">⚠ {overdue.length} waiting over {checkHours} hours</div>}
      </button>

      <Btn as={Link} to="/admin/new" variant="ghost" className="w-full">＋ Add a booking</Btn>

      {/* The selected day's appointments (defaults to today), then the calendar */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">

        <div ref={dayRef} className="scroll-mt-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              {day === today && <div className="text-xs font-semibold uppercase tracking-widest text-rose">Today</div>}
              <h2 className="font-display text-2xl font-semibold">{fmtDateLong(day)}</h2>
            </div>
            {day !== today && <button onClick={goToday} className="min-h-11 shrink-0 text-sm font-semibold text-peach underline">Back to today</button>}
          </div>
          {dayItems.length === 0 && (
            <EmptyState icon={day === today ? '☀' : '☾'} title={day === today ? 'No appointments today' : 'No appointments this day'}>
              {day === today ? 'Enjoy the breather.' : 'Nothing booked and no open times.'}
            </EmptyState>
          )}
          <div className="grid gap-3">
            {dayItems.map((it, i) => it.b
              ? <DayCard key={it.b.id} b={it.b} next={it.b.id === nextId} onQuick={setQuick} i={i} />
              : <div key={it.t} className="rounded-2xl border border-dashed border-cream/15 p-3 text-sm text-cream/50">{fmtTime(it.t)} · Open, no booking</div>)}
          </div>
        </div>
        <Card>
          <Calendar month={month} onMonth={setMonth} selected={day} onSelect={pickDay}
            badge={(k, sel) => {
              const n = (byDay[k] || []).filter((r) => r.status !== 'no_show').length
              if (!n) return null
              const hot = (byDay[k] || []).some((r) => NEEDS_ACTION.includes(r.status))
              return <span className={sel ? 'text-ink' : hot ? 'text-amber-200' : 'text-rose'}>● {n}</span>
            }} />
          <p className="pt-2 text-xs text-cream/50">● = bookings that day · <span className="text-amber-200">amber</span> = waiting on payment or your check</p>
        </Card>
      </div>

      {/* Lists */}
      <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
        <button className={seg(tab === 'upcoming')} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button className={seg(tab === 'all')} onClick={() => setTab('all')}>All</button>
        <button className={seg(tab === 'history')} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'upcoming' && (
        <div className="space-y-3">
          <p className="text-xs text-cream/60">Unpaid, pending and approved bookings from today on, soonest first.</p>
          {upcoming.length === 0 && <EmptyState icon="✿" title="No upcoming bookings yet">New bookings show up here as soon as clients reserve.</EmptyState>}
          <div className="grid gap-3 lg:grid-cols-2">{upcoming.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} showDate onExpire={load} />)}</div>
        </div>
      )}

      {(tab === 'all' || tab === 'history') && (
        <div className="space-y-3">
          <input className={inputCls} placeholder="Search name, @instagram, phone or code" value={q} onChange={(e) => setQ(e.target.value)} />
          {tab === 'all' ? (
            <>
              <FilterChips filters={ALL_FILTERS} value={allFilter} onChange={setAllFilter} count={countIn(ALL_FILTERS)} />
              <p className="text-xs text-cream/60">{allFilter === 'all' ? 'Every booking, whatever its status, by appointment date.' : 'By appointment date, soonest first.'}</p>
              {allList.length === 0 && <EmptyState icon="⌕" title="Nothing here">{q ? 'No bookings match your search.' : 'No bookings with this status.'}</EmptyState>}
              <div className="grid gap-3 lg:grid-cols-2">{allList.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} showDate onExpire={load} />)}</div>
            </>
          ) : (
            <>
              <FilterChips filters={HISTORY_FILTERS} value={histFilter} onChange={setHistFilter} count={countIn(HISTORY_FILTERS)} />
              <p className="text-xs text-cream/60">Finished bookings: what happened after each appointment. Most recent first.</p>
              {histList.length === 0 && <EmptyState icon="⌕" title="Nothing here">{q ? 'No bookings match your search.' : 'No finished bookings with this status yet.'}</EmptyState>}
              <div className="grid gap-3 lg:grid-cols-2">{histList.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} showDate onExpire={load} />)}</div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog open={!!quick} busy={qBusy}
        title={quick?.status === 'completed' ? 'Mark as done?' : 'Mark as no-show?'}
        body={quick ? `${quick.b.full_name} · ${fmtTime(quick.b.slot_time)}` : ''}
        confirmLabel={quick?.status === 'completed' ? 'Yes, done' : 'Yes, no-show'} danger={quick?.status === 'no_show'}
        onConfirm={runQuick} onCancel={() => setQuick(null)} />
    </div>
  )
}
