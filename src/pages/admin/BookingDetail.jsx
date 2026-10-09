import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseISO, startOfMonth } from 'date-fns'
import { supabase, publicUrl } from '../../lib/supabase'
import { ACTIVE, FINISHED, REMOVALS, SERVICES } from '../../lib/config'
import { fmtDate, fmtDateLong, fmtTime, peso, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, StatusBadge, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import Countdown from '../../components/Countdown'
import Lightbox from '../../components/Lightbox'

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
        supabase.from('schedule_slots').select('slot_date,slot_time').eq('is_open', true).gte('slot_date', ymd(new Date())).order('slot_date').order('slot_time'),
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
  const nav = useNavigate()
  const [view, setView] = useState(null)
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [b, setB] = useState(null)
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const [{ data }, n] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', id).single(),
      supabase.from('booking_notes').select('note').eq('booking_id', id).maybeSingle(),
    ])
    setB(data); setPrice(data?.final_price ?? ''); setNote(n.data?.note ?? '')
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
    const r1 = await supabase.from('bookings').update({ final_price: price === '' ? null : Number(price) }).eq('id', b.id)
    const r2 = note.trim()
      ? await supabase.from('booking_notes').upsert({ booking_id: b.id, note: note.trim(), updated_at: new Date().toISOString() })
      : await supabase.from('booking_notes').delete().eq('booking_id', b.id)
    if (r1.error || r2.error) return setErr('Could not save.')
    setMsg('Saved ✓'); load()
  }

  const receipt = b.receipt_path ? publicUrl('receipts', b.receipt_path) : null
  const canDelete = FINISHED.includes(b.status)

  async function hardDelete() {
    setBusy(true); setErr('')
    // 1. every receipt file for this booking (a client may have uploaded more than one)
    const list = await supabase.storage.from('receipts').list(b.code, { limit: 100 })
    const paths = (list.data || []).map((f) => `${b.code}/${f.name}`)
    if (b.receipt_path && !paths.includes(b.receipt_path)) paths.push(b.receipt_path)
    if (paths.length) {
      const rm = await supabase.storage.from('receipts').remove(paths)
      if (rm.error) { setBusy(false); return setErr('Could not delete the receipt files, so nothing was deleted. Please try again.') }
    }
    // 2. the booking itself (its private note is removed with it)
    const { error } = await supabase.from('bookings').delete().eq('id', b.id)
    setBusy(false)
    if (error) return setErr('Could not delete the booking.')
    nav('/admin', { replace: true })
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
      <Link to="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-peach">← Back to bookings</Link>
      <Card className="space-y-1 text-center">
        <div className="font-display text-3xl font-bold">{b.full_name}</div>
        <div className="break-all font-mono text-4xl font-bold tracking-wider text-rose">{b.code}</div>
        <div><StatusBadge status={b.status} /></div>
        <div className="text-lg">{fmtDateLong(b.slot_date)} · {fmtTime(b.slot_time)}</div>
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-cream/60">Receipt</span>
          <span className={receipt ? 'font-semibold text-emerald-200' : 'text-cream/60'}>{receipt ? '✓ Uploaded' : 'Not uploaded'}</span>
        </div>
        {receipt && <Btn variant="soft" className="w-full" onClick={() => setView(0)}>🧾 View receipt</Btn>}
        <Field label="Final price (₱)" hint="Leave blank to use the estimate. Clients can see this.">
          <input className={inputCls} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder={String(b.estimated_price)} />
        </Field>
        <Field label="Private note" hint="Only you can see this. Clients never can."><textarea className={inputCls + ' min-h-20 py-2'} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn className="w-full" onClick={saveExtras}>Save price & note</Btn>
        {msg && <p className="text-center text-sm text-emerald-200">{msg}</p>}
      </Card>

      {isActive && <Reschedule b={b} onMoved={load} />}

      {canDelete && (
        <Card className="space-y-2 border-red-400/30">
          <h2 className="font-semibold text-red-200">Delete from history</h2>
          <p className="text-xs text-cream/70">Permanently removes this booking, its receipt pictures and your private note. This can’t be undone.</p>
          <Btn variant="danger" className="w-full" onClick={() => { setDelText(''); setDelOpen(true) }}>Delete permanently</Btn>
        </Card>
      )}

      <Lightbox images={receipt ? [receipt] : []} index={view} onIndex={setView} onClose={() => setView(null)} />
      {delOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-cream/15 bg-wine p-5">
            <h3 className="font-display text-2xl font-bold">Delete permanently?</h3>
            <p className="text-sm text-cream/80">{b.full_name}’s booking {b.code} and everything attached to it will be erased. Type <b>DELETE</b> to confirm.</p>
            <input className={inputCls} value={delText} onChange={(e) => setDelText(e.target.value)} autoCapitalize="characters" placeholder="DELETE" />
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => setDelOpen(false)} disabled={busy}>Go back</Btn>
              <Btn variant="danger" disabled={delText.trim().toUpperCase() !== 'DELETE' || busy} onClick={hardDelete}>{busy ? 'Deleting…' : 'Delete'}</Btn>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!act} title={act?.title} body={act?.body} confirmLabel={act?.label} danger={act?.danger} busy={busy}
        onConfirm={runAction} onCancel={() => setDlg(null)} />
    </div>
  )
}
