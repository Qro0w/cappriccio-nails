import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calcPrice, intensiveAllowed, ALL_TIMES, ACTIVE, SERVICES } from '../../lib/config'
import { cleanIg, cleanPhone, fmtTime, peso, validPhone, ymd } from '../../lib/format'
import { Btn, Card, ErrorText, Field, FormAlert, inputCls } from '../../components/ui'
import ServiceFields, { serviceErrors } from '../../components/ServiceFields'

const label = (t) => fmtTime(t.length === 5 ? t + ':00' : t)

// The nailtech books someone in herself (DMs, walk-ins, friends). No client rules apply.
export default function NewBooking() {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', ig: '', phone: '', age: '', date: ymd(new Date()), time: '', custom: '', paid: 'yes', dp: '' })
  const [svc, setSvc] = useState({ service: '', length: '', removal: 'none', tier: '', intensive: false })
  const [slots, setSlots] = useState([])
  const [taken, setTaken] = useState([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!f.date) return
    Promise.all([
      supabase.from('schedule_slots').select('slot_time,is_open').eq('slot_date', f.date).order('slot_time'),
      supabase.from('bookings').select('slot_time').eq('slot_date', f.date).in('status', ACTIVE),
    ]).then(([s, b]) => {
      setSlots((s.data || []).map((x) => x.slot_time.slice(0, 5)))
      setTaken((b.data || []).map((x) => x.slot_time.slice(0, 5)))
    })
  }, [f.date])

  const time = f.time === 'custom' ? f.custom : f.time
  const sErr = serviceErrors(svc)
  const errs = {
    name: !f.name.trim() ? 'Enter the client’s name.' : '',
    phone: f.phone.trim() && !validPhone(f.phone) ? 'That phone number doesn’t look right (or leave it blank).' : '',
    date: !f.date ? 'Pick a date.' : '',
    time: !time ? 'Pick a time.' : taken.includes(time) ? 'That time already has a booking.' : '',
    dp: f.paid === 'yes' && f.dp !== '' && Number(f.dp) < 1 ? 'Enter the amount, or leave it blank.' : '',
  }
  const all = { ...errs, ...sErr }
  const missing = Object.entries(all).filter(([, v]) => v).map(([k]) => ({ name: 'Name', phone: 'Phone', date: 'Date', time: 'Time', dp: 'Downpayment', service: 'Service', length: 'Length', removal: 'Removal', tier: 'Tier' }[k]))
  const price = calcPrice(svc.service, SERVICES[svc.service]?.ext ? svc.length : null, svc.removal, svc.intensive)

  async function save() {
    if (missing.length) return setTried(true)
    setBusy(true); setErr('')
    const intensive = !!svc.intensive && intensiveAllowed(svc.service, svc.tier, svc.removal)
    const { data, error } = await supabase.rpc('admin_create_booking', {
      p_name: f.name.trim(), p_ig: f.ig.trim() ? cleanIg(f.ig) : '', p_phone: f.phone.trim() ? cleanPhone(f.phone) : '',
      p_age: f.age ? Number(f.age) : null, p_service: svc.service, p_length: SERVICES[svc.service].ext ? svc.length : null,
      p_removal: svc.removal, p_tier: Number(svc.tier), p_intensive: intensive,
      p_date: f.date, p_time: time, p_status: f.paid === 'yes' ? 'confirmed' : 'awaiting_payment',
      p_dp: f.paid === 'yes' && f.dp !== '' ? Number(f.dp) : null,
    })
    setBusy(false)
    if (error) return setErr(error.message.includes('SLOT_TAKEN') ? 'That time already has a booking.' : 'Could not save the booking. Please try again.')
    const { data: row } = await supabase.from('bookings').select('id').eq('code', data).single()
    nav(row ? `/admin/booking/${row.id}` : '/admin', { replace: true })
  }
  const e = (k) => (tried ? all[k] : '')
  const times = [...new Set([...slots, ...ALL_TIMES])].sort()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-peach">← Back to bookings</Link>
      <h1 className="font-display text-3xl font-semibold">Add a booking</h1>
      <p className="text-sm text-cream/70">For clients who booked through DM, walk-ins or friends. Any date and time works, even ones that are closed or hidden from clients.</p>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Client</h2>
        <Field label="Name" error={e('name')}><input className={inputCls} value={f.name} onChange={(x) => set('name', x.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Instagram (optional)"><input className={inputCls} value={f.ig} onChange={(x) => set('ig', x.target.value)} placeholder="@handle" autoCapitalize="none" /></Field>
          <Field label="Age (optional)"><input className={inputCls} inputMode="numeric" value={f.age} onChange={(x) => set('age', x.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
        </div>
        <Field label="Phone (optional)" error={e('phone')}><input className={inputCls} inputMode="tel" value={f.phone} onChange={(x) => set('phone', x.target.value)} placeholder="09XX XXX XXXX" /></Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Date & time</h2>
        <Field label="Date" error={e('date')}><input type="date" className={inputCls} value={f.date} onChange={(x) => { set('date', x.target.value); set('time', '') }} /></Field>
        <Field label="Time" error={e('time')}>
          <div className="grid grid-cols-3 gap-2">
            {times.map((t) => {
              const busyT = taken.includes(t)
              return (
                <button key={t} type="button" disabled={busyT} onClick={() => set('time', t)}
                  className={`min-h-11 rounded-xl border text-sm ${f.time === t ? 'border-cream bg-cream text-ink' : busyT ? 'border-cream/10 text-cream/30 line-through' : slots.includes(t) ? 'border-cream/30' : 'border-dashed border-cream/20 text-cream/60'}`}>
                  {label(t)}
                </button>
              )
            })}
            <button type="button" onClick={() => set('time', 'custom')} className={`min-h-11 rounded-xl border text-sm ${f.time === 'custom' ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>Other…</button>
          </div>
        </Field>
        {f.time === 'custom' && <input type="time" className={inputCls} value={f.custom} onChange={(x) => set('custom', x.target.value)} />}
        <p className="text-xs text-cream/50">Solid = open slot on your schedule · dashed = not on the schedule yet (it’s added for you) · crossed out = already booked</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Service</h2>
        <ServiceFields value={svc} onChange={setSvc} errors={tried ? sErr : {}} />
        {price != null && <div className="flex justify-between text-sm"><span className="text-cream/60">Estimated base total</span><span className="font-semibold text-rose">{peso(price)}</span></div>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Downpayment</h2>
        <div className="grid grid-cols-2 gap-2">
          {[['yes', 'Already paid (approved)'], ['no', 'Waiting for downpayment']].map(([k, t]) => (
            <button key={k} type="button" onClick={() => set('paid', k)} className={`min-h-12 rounded-xl border px-2 text-sm ${f.paid === k ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{t}</button>
          ))}
        </div>
        {f.paid === 'yes'
          ? <Field label="Amount received (₱, optional)" error={e('dp')}><input className={inputCls} inputMode="numeric" value={f.dp} onChange={(x) => set('dp', x.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 400" /></Field>
          : <p className="text-xs text-cream/60">The usual 12-hour timer applies. Send the client their booking code so they can upload the receipt.</p>}
      </Card>

      {tried && <FormAlert items={[...new Set(missing)]} />}
      <ErrorText>{err}</ErrorText>
      <Btn className="w-full" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save booking'}</Btn>
    </div>
  )
}
