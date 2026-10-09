import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseISO, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, REMOVALS, SERVICES } from '../../lib/config'
import { fmtDate, fmtDateLong, fmtTime, peso, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, StatusBadge, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import Countdown from '../../components/Countdown'

function Reschedule({ b, onMoved }) {
  const [open, setOpen] = useState(false)
  const [free, setFree] = useState([])
  const [month, setMonth] = useState(startOfMonth(parseISO(b.slot_date)))
  const [day, setDay] = useState(null)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const [s, t] = await Promise.all([
        supabase.from('schedule_slots').select('slot_date,slot_time').gte('slot_date', ymd(new Date())).order('slot_date').order('slot_time'),
        supabase.from('bookings').select('slot_date,slot_time').in('status', ACTIVE),
      ])
      const taken = new Set((t.data || []).map((x) => `${x.slot_date}|${x.slot_time}`))
      setFree((s.data || []).filter((x) => !taken.has(`${x.slot_date}|${x.slot_time}`)))
    })()
  }, [open])

  const byDate = useMemo(() => {
    const m = {}
    free.forEach((s) => (m[s.slot_date] ||= []).push(s.slot_time))
    return m
  }, [free])

  async function move() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('bookings')
      .update({ slot_date: target.date, slot_time: target.time, rescheduled_count: b.rescheduled_count + 1 }).eq('id', b.id)
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'That slot was just taken. Pick another.' : 'Could not move the booking.')
    setOpen(false); setTarget(null); onMoved()
  }

  if (!open) return <Btn variant="ghost" className="w-full" onClick={() => setOpen(true)}>Reschedule (move to another slot)</Btn>
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold text-peach">Move to which slot?</h3>
      <Calendar month={month} onMonth={setMonth} selected={day} onSelect={(d) => { setDay(d); setTarget(null) }}
        isDisabled={(k) => !byDate[k]} badge={(k, sel) => byDate[k] && <span className={sel ? 'text-ink' : 'text-rose'}>{byDate[k].length}</span>} />
      {day && (
        <div className="grid grid-cols-3 gap-2">
          {(byDate[day] || []).map((t) => (
            <button key={t} onClick={() => setTarget({ date: day, time: t })}
              className={`min-h-11 rounded-xl border text-sm ${target?.time === t && target?.date === day ? 'border-rose bg-rose text-ink' : 'border-cream/25'}`}>{fmtTime(t)}</button>
          ))}
        </div>
      )}
      <ErrorText>{err}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => setOpen(false)}>Close</Btn>
        <Btn disabled={!target || busy} onClick={move}>{target ? `Move to ${fmtDate(target.date)}, ${fmtTime(target.time)}` : 'Pick a slot'}</Btn>
      </div>
    </Card>
  )
}

export default function BookingDetail() {
  const { id } = useParams()
  const [b, setB] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const { data } = await supabase.from('bookings').select('*').eq('id', id).single()
    setB(data); setPrice(data?.final_price ?? ''); setNote(data?.admin_note ?? '')
    if (data?.receipt_path) {
      const s = await supabase.storage.from('receipts').createSignedUrl(data.receipt_path, 3600)
      setReceipt(s.data?.signedUrl || null)
    } else setReceipt(null)
  }, [id])
  useEffect(() => { load() }, [load])

  if (!b) return <p className="text-center text-cream/60">Loading…</p>

  const ACTIONS = {
    confirm:  { status: 'confirmed', title: 'Confirm payment?', label: 'Yes, confirm', body: `Mark ${b.full_name}'s downpayment as received. They will see the location and reminders.` },
    reject:   { status: 'rejected',  title: 'Reject this booking?', label: 'Yes, reject', danger: true, body: `This rejects ${b.full_name}'s booking on ${fmtDate(b.slot_date)} at ${fmtTime(b.slot_time)}. The slot opens for other clients right away. This can't be undone.` },
    cancel:   { status: 'cancelled', title: 'Cancel this booking?', label: 'Yes, cancel it', danger: true, body: `This cancels ${b.full_name}'s confirmed booking on ${fmtDate(b.slot_date)} at ${fmtTime(b.slot_time)} and opens the slot. This can't be undone.` },
    complete: { status: 'completed', title: 'Mark as completed?', label: 'Yes, completed', body: 'The appointment is done.' },
    noshow:   { status: 'no_show',   title: 'Mark as no-show?', label: 'Yes, no-show', danger: true, body: `${b.full_name} did not show up. The slot will be opened.` },
  }
  const act = dlg && ACTIONS[dlg]

  async function runAction() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('bookings').update({ status: act.status }).eq('id', b.id)
    setBusy(false); setDlg(null)
    if (error) return setErr('Could not update. Please try again.')
    load()
  }
  async function saveExtras() {
    setErr(''); setMsg('')
    const { error } = await supabase.from('bookings')
      .update({ final_price: price === '' ? null : Number(price), admin_note: note.trim() || null }).eq('id', b.id)
    if (error) return setErr('Could not save.')
    setMsg('Saved ✓'); load()
  }

  const isActive = ACTIVE.includes(b.status)
  const pending = b.status === 'awaiting_payment' || b.status === 'payment_submitted'
  const ig = b.instagram.replace('@', '')
  const rows = [
    ['Instagram', b.instagram], ['Phone', b.phone], ['Age', b.age],
    ['Service', SERVICES[b.service].label + (b.length ? ` (${b.length})` : '')],
    ['Removal', REMOVALS[b.removal].label], ['Design tier', `Tier ${b.tier}`], ['Intensive manicure', b.intensive ? 'Yes' : 'No'],
    ['Booked on', new Date(b.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })],
    ...(b.rescheduled_count ? [['Times rescheduled', b.rescheduled_count]] : []),
  ]

  return (
    <div className="space-y-4">
      <Link to="/admin" className="text-sm text-cream/60 underline">← Back to bookings</Link>
      <Card className="space-y-1 text-center">
        <div className="font-display text-3xl font-bold">{b.full_name}</div>
        <div className="font-mono text-xs text-cream/60">{b.code}</div>
        <div><StatusBadge status={b.status} /></div>
        <div className="text-lg text-rose">{fmtDateLong(b.slot_date)} · {fmtTime(b.slot_time)}</div>
        {b.status === 'awaiting_payment' && <div className="pt-1">⏳ <Countdown expiresAt={b.expires_at} onExpire={load} className="text-2xl" /> left to pay</div>}
      </Card>

      {b.age < 15 && <p className="rounded-xl border border-amber-300/50 bg-amber-400/10 p-3 text-sm text-amber-200">⚑ This client is under 15 ({b.age}). Please review before confirming.</p>}
      <ErrorText>{err}</ErrorText>

      {pending && (
        <div className="space-y-2">
          <Btn className="w-full" onClick={() => setDlg('confirm')}>{b.receipt_path ? '✓ Confirm payment' : '✓ Mark as paid (no receipt)'}</Btn>
          <Btn variant="danger" className="w-full" onClick={() => setDlg('reject')}>Reject booking</Btn>
        </div>
      )}
      {b.status === 'confirmed' && (
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => setDlg('complete')}>✓ Completed</Btn>
          <Btn variant="ghost" onClick={() => setDlg('noshow')}>No-show</Btn>
          <Btn variant="danger" className="col-span-2" onClick={() => setDlg('cancel')}>Cancel booking</Btn>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Btn as="a" variant="ghost" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">Instagram</Btn>
        <Btn as="a" variant="ghost" href={`tel:${b.phone}`}>Call</Btn>
        <Btn as="a" variant="ghost" href={`sms:${b.phone}`}>Text</Btn>
      </div>

      <Card className="space-y-1 text-sm">
        <h2 className="mb-1 font-semibold text-peach">Client form</h2>
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-peach">Payment & price</h2>
        <div className="flex justify-between text-sm"><span className="text-cream/60">Estimated base total</span><span>{peso(b.estimated_price)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-cream/60">Downpayment sent</span><span>{b.dp_amount != null ? peso(b.dp_amount) : 'None yet'}</span></div>
        {receipt && <a href={receipt} target="_blank" rel="noreferrer"><img src={receipt} alt="GCash receipt" className="max-h-80 w-full rounded-xl object-contain bg-ink/60" /></a>}
        <Field label="Final price (₱)" hint="Leave blank to use the estimate. Clients can see this.">
          <input className={inputCls} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder={String(b.estimated_price)} />
        </Field>
        <Field label="Private note"><textarea className={inputCls + ' min-h-20 py-2'} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn className="w-full" onClick={saveExtras}>Save price & note</Btn>
        {msg && <p className="text-center text-sm text-emerald-200">{msg}</p>}
      </Card>

      {isActive && <Reschedule b={b} onMoved={load} />}

      <ConfirmDialog open={!!act} title={act?.title} body={act?.body} confirmLabel={act?.label} danger={act?.danger} busy={busy}
        onConfirm={runAction} onCancel={() => setDlg(null)} />
    </div>
  )
}
