import { useCallback, useEffect, useState } from 'react'
import { addDays, format, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, ALL_TIMES, RULESET_LABEL, SLOT_PRESETS } from '../../lib/config'
import { fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Switch } from '../../components/ui'
import Calendar from '../../components/Calendar'

const hhmm = (t) => t.slice(0, 5)

export default function Schedule() {
  const [slots, setSlots] = useState([])
  const [booked, setBooked] = useState([])
  const [months, setMonths] = useState([])
  const [days, setDays] = useState([])
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(ymd(new Date()))
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    const [s, b, m, d] = await Promise.all([
      supabase.from('schedule_slots').select('*').order('slot_date').order('slot_time'),
      supabase.from('bookings').select('slot_date,slot_time').in('status', ACTIVE),
      supabase.from('schedule_months').select('*'),
      supabase.from('schedule_days').select('*'),
    ])
    setSlots(s.data || []); setBooked(b.data || []); setMonths(m.data || []); setDays(d.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const fail = (r) => { if (r.error) setErr('Could not save that change. Please try again.'); else setErr(''); load() }

  const monthKey = ymd(startOfMonth(month))
  const mrow = months.find((m) => m.month === monthKey)
  const drow = days.find((d) => d.day === day)
  const todays = slots.filter((s) => s.slot_date === day)
  const isBooked = (t) => booked.some((b) => b.slot_date === day && hhmm(b.slot_time) === t)
  const times = [...new Set([...ALL_TIMES, ...todays.map((s) => hhmm(s.slot_time))])].sort()
  const countFor = (k) => slots.filter((s) => s.slot_date === k).length

  // Is this date hidden from clients right now, and why? (mirrors slot_visible() in the database)
  function hiddenReason(k) {
    const m = months.find((x) => x.month === ymd(startOfMonth(new Date(`${k}T00:00:00`))))
    if (!m || !m.visible) return 'month'
    if (days.find((d) => d.day === k)?.visible === false) return 'day'
    if (m.window_days != null && k > ymd(addDays(new Date(), m.window_days))) return 'window'
    return null
  }

  async function setMonthVisible(on) {
    fail(await supabase.from('schedule_months').upsert({ month: monthKey, visible: on, ruleset: mrow?.ruleset || 'sheet', window_days: mrow?.window_days ?? null }))
  }
  async function setDayFlag(patch) {
    fail(await supabase.from('schedule_days').upsert({ day, visible: drow?.visible ?? true, allow_any: drow?.allow_any ?? false, ...patch }))
  }
  async function toggle(t) {
    const open = todays.some((s) => hhmm(s.slot_time) === t)
    if (open) {
      if (isBooked(t)) return setErr('This slot has an active booking. Move or reject that booking first.')
      return fail(await supabase.from('schedule_slots').delete().eq('slot_date', day).eq('slot_time', t))
    }
    fail(await supabase.from('schedule_slots').insert({ slot_date: day, slot_time: t }))
  }
  async function applyPreset(list) {
    const have = new Set(todays.map((s) => hhmm(s.slot_time)))
    const add = list.filter((t) => !have.has(t)).map((t) => ({ slot_date: day, slot_time: t }))
    if (!add.length) return
    fail(await supabase.from('schedule_slots').insert(add))
  }
  async function closeDay() {
    setClosing(false)
    if (booked.some((b) => b.slot_date === day)) return setErr('This day has active bookings. Move or reject them first.')
    fail(await supabase.from('schedule_slots').delete().eq('slot_date', day))
  }

  const reason = hiddenReason(day)
  const reasonText = { month: 'The whole month is hidden from clients.', day: 'You turned this day off for clients.', window: 'Outside the visibility window, so clients can’t see it yet.' }
  const mvisible = !!mrow?.visible

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Schedule</h1>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl font-bold">{format(month, 'MMMM yyyy')}</div>
            <div className="text-xs text-cream/60">{mvisible ? 'Visible to clients' : 'Hidden from clients'}</div>
          </div>
          <Switch checked={mvisible} onChange={setMonthVisible} label="Show this month to clients" />
        </div>
        {mrow && (
          <p className="text-xs text-cream/60">
            {RULESET_LABEL[mrow.ruleset]}
            {mrow.window_days != null && ` · clients only see dates up to ${mrow.window_days} days ahead (turn individual days off to hold some back)`}
          </p>
        )}
      </Card>

      <Card>
        <Calendar month={month} onMonth={setMonth} selected={day} onSelect={setDay}
          badge={(k, sel) => {
            const n = countFor(k)
            if (!n) return <span className={sel ? 'text-ink' : 'text-cream/30'}>off</span>
            return <span className={sel ? 'text-ink' : hiddenReason(k) ? 'text-cream/40' : 'text-rose'}>{hiddenReason(k) ? '🙈' : n}</span>
          }} />
        <p className="pt-3 text-xs text-cream/50">Number = open times · 🙈 = has times but clients can’t see it · off = no times</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl font-bold">{fmtDateLong(day)}</h2>
        {reason && todays.length > 0 && <p className="rounded-xl bg-cream/10 p-2 text-xs text-peach">{reasonText[reason]}</p>}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-cream/15 p-3">
          <span className="text-sm">Show this day to clients</span>
          <Switch checked={drow?.visible ?? true} onChange={(v) => setDayFlag({ visible: v })} label="Show this day" />
        </div>

        <div>
          <div className="mb-2 text-sm text-peach">Time slots (tap to open / remove)</div>
          <div className="grid grid-cols-3 gap-2">
            {times.map((t) => {
              const on = todays.some((s) => hhmm(s.slot_time) === t)
              return (
                <button key={t} onClick={() => toggle(t)}
                  className={`min-h-12 rounded-xl border text-sm font-semibold ${on ? 'border-rose bg-rose text-ink' : 'border-cream/25 text-cream/60'}`}>
                  {fmtTime(t + ':00')}{isBooked(t) && ' 🔒'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} className="min-h-12 flex-1 rounded-xl border border-cream/20 bg-ink/60 px-3" />
          <Btn variant="ghost" disabled={!custom} onClick={() => { toggle(custom); setCustom('') }}>Add time</Btn>
        </div>

        <details className="rounded-xl border border-cream/15 p-3">
          <summary className="min-h-8 cursor-pointer text-sm text-peach">Quick fill</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(SLOT_PRESETS).map(([label, list]) => (
              <Btn key={label} variant="ghost" className="!min-h-11 text-sm" onClick={() => applyPreset(list)}>{label}</Btn>
            ))}
          </div>
        </details>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-cream/15 p-3">
          <div className="text-sm">
            Any service combination can be booked at any time for this day
            <div className="text-xs text-cream/60">Off by default. When on, it skips the service and tier rules for this day.</div>
          </div>
          <Switch checked={drow?.allow_any ?? false} onChange={(v) => setDayFlag({ allow_any: v })} label="Allow any service combination" />
        </div>

        <ErrorText>{err}</ErrorText>
        {todays.length > 0 && <Btn variant="danger" className="w-full" onClick={() => setClosing(true)}>Remove all times for this day</Btn>}
        <p className="text-xs text-cream/50">🔒 = has an active booking (can’t be removed). Changes show to clients right away and never delete bookings.</p>
      </Card>
      <ConfirmDialog open={closing} danger title="Remove all times?" body="All open times on this date will be removed so clients can't book it." confirmLabel="Yes, remove" onConfirm={closeDay} onCancel={() => setClosing(false)} />
    </div>
  )
}
