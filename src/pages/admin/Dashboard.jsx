import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { ACTIVE, ACTIVE_FILTERS, HISTORY_FILTERS, REMOVALS, SERVICES } from '../../lib/config'
import { balanceOf, fmtDateLong, fmtTime, peso, slotStart, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, StatusBadge, inputCls } from '../../components/ui'
import { EmptyState, Skeleton } from '../../components/Feedback'
import { IgIcon } from '../../components/Icons'
import Calendar from '../../components/Calendar'
import BookingRow from '../../components/BookingRow'
import Phrases from '../../components/Phrases'
import { useRemembered, useRememberedScroll } from '../../lib/remember'

const SHOWN_IN_DAY = [...ACTIVE, 'completed', 'no_show']
const NEEDS_ACTION = ['awaiting_payment', 'payment_submitted']

export default function Dashboard() {
  const [rows, setRows] = useState(null)
  const [slots, setSlots] = useState([])
  const [view, setView] = useRemembered('bk.view', 'today')
  const [quick, setQuick] = useState(null) // { b, status }
  const [qBusy, setQBusy] = useState(false)
  const [filter, setFilter] = useRemembered('bk.filter', 'all') // History filter
  const [aFilter, setAFilter] = useRemembered('bk.aFilter', 'payment_submitted') // Active filter
  const [q, setQ] = useRemembered('bk.q', '')
  const [month, setMonth] = useRemembered('bk.month', () => startOfMonth(new Date()))
  const [day, setDay] = useRemembered('bk.day', () => ymd(new Date()))
  const [checkHours, setCheckHours] = useState(12)
  useRememberedScroll('bookings', rows !== null)

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
  const action = (rows || []).filter((r) => NEEDS_ACTION.includes(r.status))
  const toCheck = (rows || []).filter((r) => r.status === 'payment_submitted')
  const overdue = toCheck.filter((r) => r.receipt_uploaded_at && (Date.now() - new Date(r.receipt_uploaded_at)) / 36e5 >= checkHours)
  const byDay = useMemo(() => {
    const m = {}
    ;(rows || []).filter((r) => SHOWN_IN_DAY.includes(r.status)).forEach((r) => (m[r.slot_date] ||= []).push(r))
    return m
  }, [rows])

  const needle = q.trim().toLowerCase().replace(/^@/, '')
  const matches = (r) => !needle || [r.full_name, r.instagram, r.phone, r.code].some((v) => (v || '').toLowerCase().includes(needle))
  const statusesOf = (filters, key) => filters.find((f) => f[0] === key)?.[2] || []

  // Active: Pending & Unpaid = first come first served (booked earliest first); Confirmed = soonest appointment first
  const active = useMemo(() => {
    const st = statusesOf(ACTIVE_FILTERS, aFilter)
    const list = (rows || []).filter((r) => st.includes(r.status) && matches(r))
    return aFilter === 'confirmed'
      ? list.sort((a, b) => (a.slot_date + a.slot_time < b.slot_date + b.slot_time ? -1 : 1))
      : list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  }, [rows, aFilter, needle]) // eslint-disable-line

  // History: most recent first, whatever the filter
  const history = useMemo(() => {
    const st = statusesOf(HISTORY_FILTERS, filter)
    const last = (r) => r.updated_at || r.created_at
    return (rows || []).filter((r) => st.includes(r.status) && matches(r)).sort((a, b) => (last(a) < last(b) ? 1 : -1))
  }, [rows, filter, needle]) // eslint-disable-line
  const countFor = (filters) => (key) => { const st = statusesOf(filters, key); return (rows || []).filter((r) => st.includes(r.status)).length }

  const dayTimes = useMemo(() => {
    const t = new Set(slots.filter((s) => s.slot_date === day && s.is_open !== false).map((s) => s.slot_time))
    ;(byDay[day] || []).forEach((b) => t.add(b.slot_time))
    return [...t].sort()
  }, [slots, byDay, day])

  if (!rows) return <Skeleton lines={5} />

  const todays = (byDay[today] || []).slice().sort((a, b) => (a.slot_time < b.slot_time ? -1 : 1))
  const nextId = todays.find((b) => ACTIVE.includes(b.status) && slotStart(b.slot_date, b.slot_time) > Date.now() - 2 * 36e5)?.id
  async function runQuick() {
    setQBusy(true)
    await supabase.from('bookings').update({ status: quick.status }).eq('id', quick.b.id)
    setQBusy(false); setQuick(null); load()
  }

  const seg = (on) => `min-h-11 flex-1 rounded-lg text-sm font-semibold ${on ? 'bg-cream text-ink' : 'text-cream/70'}`
  return (
    <div className="space-y-4">
      <Phrases />
      <button onClick={() => { setView('active'); setAFilter('payment_submitted') }}
        className={`w-full rounded-2xl border p-4 text-left ${toCheck.length ? 'border-peach/50 bg-peach/10' : 'border-cream/20 bg-plum/55'}`}>
        <div className="text-2xl font-bold">{toCheck.length}</div>
        <div className="text-sm text-cream/80">{toCheck.length ? `receipt(s) to check (tap to view)` : action.length ? `Nothing to check · ${action.length} waiting for payment` : 'Nothing needs your attention 🎉'}</div>
        {overdue.length > 0 && <div className="mt-1 text-sm font-semibold text-peach">⚠ {overdue.length} waiting over {checkHours} hours</div>}
      </button>

      <Btn as={Link} to="/admin/new" variant="ghost" className="w-full">＋ Add a booking</Btn>

      <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
        <button className={seg(view === 'today')} onClick={() => setView('today')}>Today</button>
        <button className={seg(view === 'active')} onClick={() => setView('active')}>Active</button>
        <button className={seg(view === 'calendar')} onClick={() => setView('calendar')}>Calendar</button>
        <button className={seg(view === 'history')} onClick={() => setView('history')}>History</button>
      </div>

      {view === 'today' && (
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">{fmtDateLong(today)}</h2>
          {todays.length === 0 && <EmptyState icon="☀" title="No appointments today">Enjoy the breather. Upcoming bookings are in the Upcoming tab.</EmptyState>}
          <div className="grid gap-3 lg:grid-cols-2">
            {todays.map((b, i) => {
              const m = balanceOf(b.final_price, b.estimated_price, b.dp_amount)
              const ig = b.instagram && b.instagram !== '-' ? b.instagram.replace('@', '') : null
              const phone = b.phone && b.phone !== '-' ? b.phone : null
              return (
                <div key={b.id} className={`anim-in space-y-2 rounded-3xl border p-4 ${b.id === nextId ? 'border-rose/60 bg-rose/10' : 'border-cream/15 bg-plum/55'}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {b.id === nextId && <div className="text-xs font-semibold uppercase tracking-widest text-rose">Up next</div>}
                      <div className="font-display text-2xl font-semibold">{fmtTime(b.slot_time)}</div>
                      <Link to={`/admin/booking/${b.id}`} className="text-lg font-semibold underline decoration-cream/30 underline-offset-4">{b.full_name}</Link>
                      <div className="text-xs text-cream/70">{SERVICES[b.service].short}{b.length ? ` · ${b.length}` : ''} · Tier {b.tier} · {REMOVALS[b.removal].label}{b.intensive ? ' · Intensive' : ''}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex justify-between rounded-2xl bg-ink/40 px-3 py-2 text-sm">
                    <span className="text-cream/70">{b.balance_paid != null ? 'Balance' : 'Left to pay'}</span>
                    <span className="font-semibold text-rose">{b.balance_paid != null ? 'Paid ✓' : peso(m.left)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {phone && <Btn as="a" variant="ghost" href={`tel:${phone}`} className="!min-h-10">Call</Btn>}
                    {ig && <Btn as="a" variant="ghost" href={`https://ig.me/m/${ig}`} target="_blank" rel="noreferrer" className="!min-h-10 gap-1.5"><IgIcon />DM</Btn>}
                    {b.status === 'confirmed' && <>
                      <Btn className="!min-h-10" onClick={() => setQuick({ b, status: 'completed' })}>✓ Done</Btn>
                      <Btn variant="ghost" className="!min-h-10" onClick={() => setQuick({ b, status: 'no_show' })}>No-show</Btn>
                    </>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
            {dayTimes.length === 0 && <EmptyState icon="☾" title="No slots on this day">Open times for this date in the Schedule tab.</EmptyState>}
            {dayTimes.map((t) => {
              const bs = (byDay[day] || []).filter((b) => b.slot_time === t)
              return bs.length
                ? bs.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} onExpire={load} />)
                : <div key={t} className="rounded-xl border border-dashed border-cream/15 p-3 text-sm text-cream/50">{fmtTime(t)} · Open, no booking</div>
            })}
          </div>
        </div>
      )}

      {view === 'active' && (
        <div className="space-y-3">
          <input className={inputCls} placeholder="Search name, @instagram, phone or code" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {ACTIVE_FILTERS.map(([key, label]) => (
              <button key={key} onClick={() => setAFilter(key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${aFilter === key ? 'border-cream bg-cream text-ink' : 'border-cream/25 text-cream/80'}`}>
                {label} <span className="opacity-70">{countFor(ACTIVE_FILTERS)(key)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-cream/60">{aFilter === 'confirmed' ? 'Soonest appointment first.' : 'First come, first served: whoever booked first is on top.'}</p>
          {active.length === 0 && <EmptyState icon="✿" title="Nothing here">{q ? 'No bookings match your search.' : 'No bookings with this status right now.'}</EmptyState>}
          <div className="grid gap-3 lg:grid-cols-2">{active.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} showDate onExpire={load} />)}</div>
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-3">
          <input className={inputCls} placeholder="Search name, @instagram, phone or code" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {HISTORY_FILTERS.map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${filter === key ? 'border-cream bg-cream text-ink' : 'border-cream/25 text-cream/80'}`}>
                {label} <span className="opacity-70">{countFor(HISTORY_FILTERS)(key)}</span>
              </button>
            ))}
          </div>
          {history.length === 0 && <EmptyState icon="⌕" title="Nothing here">{q ? 'No bookings match your search.' : 'No bookings with this status.'}</EmptyState>}
          <div className="grid gap-3 lg:grid-cols-2">{history.map((b) => <BookingRow key={b.id} b={b} checkHours={checkHours} showDate onExpire={load} />)}</div>
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
