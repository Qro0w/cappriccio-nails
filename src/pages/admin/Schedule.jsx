import { useCallback, useEffect, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, PRESET_TIMES } from '../../lib/config'
import { fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText } from '../../components/ui'
import Calendar from '../../components/Calendar'

const hhmm = (t) => t.slice(0, 5)

export default function Schedule() {
  const [slots, setSlots] = useState([])
  const [booked, setBooked] = useState([])
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(ymd(new Date()))
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.from('schedule_slots').select('*').order('slot_date').order('slot_time'),
      supabase.from('bookings').select('slot_date,slot_time').in('status', ACTIVE),
    ])
    setSlots(s.data || []); setBooked(b.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const todays = slots.filter((s) => s.slot_date === day)
  const mode = todays[0]?.rules_mode || 'matrix'
  const isBooked = (t) => booked.some((b) => b.slot_date === day && hhmm(b.slot_time) === t)
  const times = [...new Set([...PRESET_TIMES, ...todays.map((s) => hhmm(s.slot_time))])].sort()
  const countFor = (k) => slots.filter((s) => s.slot_date === k).length

  async function toggle(t) {
    setErr('')
    const open = todays.some((s) => hhmm(s.slot_time) === t)
    let res
    if (open) {
      if (isBooked(t)) return setErr('This slot has an active booking. Move or reject that booking first.')
      res = await supabase.from('schedule_slots').delete().eq('slot_date', day).eq('slot_time', t)
    } else {
      res = await supabase.from('schedule_slots').insert({ slot_date: day, slot_time: t, rules_mode: mode })
    }
    if (res.error) setErr('Could not save that change.')
    load()
  }
  async function setMode(simple) {
    const { error } = await supabase.from('schedule_slots').update({ rules_mode: simple ? 'simple' : 'matrix' }).eq('slot_date', day)
    if (error) setErr('Could not save that change.')
    load()
  }
  async function closeDay() {
    setClosing(false)
    if (booked.some((b) => b.slot_date === day)) return setErr('This day has active bookings. Move or reject them first.')
    await supabase.from('schedule_slots').delete().eq('slot_date', day)
    load()
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Schedule</h1>
      <p className="text-sm text-cream/70">Tap a date, then tap times to open or close them. Dates with no open times are OFF.</p>
      <Card>
        <Calendar month={month} onMonth={setMonth} selected={day} onSelect={setDay}
          badge={(k, sel) => { const n = countFor(k); return <span className={sel ? 'text-ink' : n ? 'text-rose' : 'text-cream/30'}>{n ? `${n} slots` : 'off'}</span> }} />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-bold">{fmtDateLong(day)}</h2>
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
        <div className="flex gap-2">
          <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} className="min-h-12 flex-1 rounded-xl border border-cream/20 bg-ink/60 px-3" />
          <Btn variant="ghost" disabled={!custom} onClick={() => { toggle(custom); setCustom('') }}>Add custom time</Btn>
        </div>
        {todays.length > 0 && (
          <label className="flex items-start gap-3 rounded-xl border border-cream/15 p-3">
            <input type="checkbox" className="mt-0.5 size-6 accent-rose" checked={mode === 'simple'} onChange={(e) => setMode(e.target.checked)} />
            <span className="text-sm">Simple rules for this day<br /><span className="text-xs text-cream/60">Ignores the tier time limits (like November). Unchecked = the December tier table applies.</span></span>
          </label>
        )}
        <ErrorText>{err}</ErrorText>
        {todays.length > 0 && <Btn variant="danger" className="w-full" onClick={() => setClosing(true)}>Close this whole day</Btn>}
        <p className="text-xs text-cream/50">🔒 = has an active booking.</p>
      </Card>
      <ConfirmDialog open={closing} danger title="Close this day?" body="All open times on this date will be removed so clients can't book it." confirmLabel="Yes, close it" onConfirm={closeDay} onCancel={() => setClosing(false)} />
    </div>
  )
}
