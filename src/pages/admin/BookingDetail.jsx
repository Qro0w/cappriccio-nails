import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseISO, startOfMonth } from 'date-fns'
import { supabase, publicUrl } from '../../lib/supabase'
import { ACTIVE, FINISHED, REMOVALS, SERVICES, STATUS, calcPrice, intensiveAllowed } from '../../lib/config'
import { balanceOf, fmtDate, fmtDateLong, fmtTime, peso, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, StatusBadge, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import Countdown from '../../components/Countdown'
import ReceiptModal from '../../components/ReceiptModal'
import { IgIcon } from '../../components/Icons'
import Collapsible from '../../components/Collapsible'
import ServiceFields, { serviceErrors } from '../../components/ServiceFields'
import { EmptyState, Skeleton } from '../../components/Feedback'

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
              className={`min-h-11 rounded-xl border text-sm ${target?.time === t && target?.date === day ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{fmtTime(t)}</button>
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

const STATUS_WORD = {
  awaiting_payment: 'Unpaid', payment_submitted: 'Pending confirmation', confirmed: 'Approved', completed: 'Completed',
  cancelled: 'Cancelled', rejected: 'Rejected', expired: 'Expired', no_show: 'No-show',
}
function prettyEvent(e) {
  if (e.kind === 'created') return `Booked for ${e.detail}`
  if (e.kind === 'status') return e.detail.replace(/[a-z_]+(?= →)|(?<=→ )[a-z_]+/g, (w) => STATUS_WORD[w] || w)
  return e.detail
}

const REJECT_REASONS = ['Receipt amount doesn’t match', 'Couldn’t verify the payment', 'Slot no longer available', 'Details incomplete']

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
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [events, setEvents] = useState([])
  const [checkHours, setCheckHours] = useState(12)
  const [confirmAmt, setConfirmAmt] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [askReason, setAskReason] = useState('')
  const [askTried, setAskTried] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [amtTried, setAmtTried] = useState(false)
  const [others, setOthers] = useState([])
  const [balOpen, setBalOpen] = useState(false)
  const [bal, setBal] = useState({ amount: '', method: 'cash' })
  const [balTried, setBalTried] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [ed, setEd] = useState(null)
  const [edTried, setEdTried] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const [fixTo, setFixTo] = useState('')
  const [fixAsk, setFixAsk] = useState(false)
  const [sec, setSec] = useState(null)

  const load = useCallback(async () => {
    await supabase.rpc('expire_stale')
    const [{ data }, n] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', id).single(),
      supabase.from('booking_notes').select('note').eq('booking_id', id).maybeSingle(),
    ])
    setB(data); setPrice(data?.final_price ?? ''); setNote(n.data?.note ?? ''); setConfirmAmt(data?.dp_amount ?? '')
    const [ev, st] = await Promise.all([
      supabase.from('booking_events').select('*').eq('booking_id', id).order('at', { ascending: false }),
      supabase.from('settings').select('value').eq('key', 'check_reminder_hours').maybeSingle(),
    ])
    setEvents(ev.data || []); if (st.data?.value) setCheckHours(Number(st.data.value) || 12)
    if (data) {
      // same client = same phone (last 10 digits) or same Instagram handle
      const digits = (x) => (x || '').replace(/\D/g, '').slice(-10)
      const handle = (x) => (x || '').toLowerCase().replace(/^@/, '').trim()
      const all = await supabase.from('bookings').select('id,code,status,slot_date,slot_time,phone,instagram,final_price,estimated_price,dp_amount,balance_paid').neq('id', id)
      const p = digits(data.phone), h = handle(data.instagram)
      setOthers((all.data || []).filter((o) => (p.length === 10 && digits(o.phone) === p) || (h && h !== '-' && handle(o.instagram) === h))
        .sort((a, b2) => (a.slot_date < b2.slot_date ? 1 : -1)))
    }
  }, [id])
  useEffect(() => { load() }, [load])

  if (!b) return <Skeleton lines={6} />

  const ACTIONS = {
    confirm:  { status: 'confirmed', title: 'Approve this booking?', label: 'Yes, approve', body: (
      <span className="block space-y-3">
        <span className="block">Check your GCash first. Once approved, {b.full_name} sees “Appointment approved”, the location and reminders.</span>
        <span className="block">
          <span className="mb-1 block text-sm font-semibold text-peach">Amount you received in GCash (₱)</span>
          <input className={inputCls} inputMode="numeric" value={confirmAmt} placeholder="e.g. 400"
            onChange={(e) => setConfirmAmt(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {amtTried && (confirmAmt === '' || Number(confirmAmt) < 1) && <span role="alert" className="mt-1 block text-xs font-semibold text-red-300">Enter the amount you actually received.</span>}
          {b.dp_amount != null && <span className="mt-1 block text-xs text-cream/60">Client typed ₱{b.dp_amount}. Change it if it’s different.</span>}
        </span>
      </span>) },
    reject:   { status: 'rejected',  title: 'Reject this booking?', label: 'Yes, reject', danger: true, body: (
      <span className="block space-y-3">
        <span className="block">This rejects {b.full_name}’s booking on {fmtDate(b.slot_date)} at {fmtTime(b.slot_time)}. The slot opens for other clients right away. This can’t be undone.</span>
        <span className="block">
          <span className="mb-1 block text-sm font-semibold text-peach">Reason (optional, shown to the client)</span>
          <span className="mb-2 flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setRejectNote(r)}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${rejectNote === r ? 'border-cream bg-cream text-ink' : 'border-cream/25 text-cream/80'}`}>{r}</button>
            ))}
          </span>
          <textarea className={inputCls + ' min-h-20 py-2'} maxLength={200} value={rejectNote} placeholder="e.g. The receipt amount doesn’t match"
            onChange={(e) => setRejectNote(e.target.value)} />
          <span className="mt-1 block text-xs text-cream/60">Leave blank to just tell them to message you on Instagram.</span>
        </span>
      </span>) },
    cancel:   { status: 'cancelled', title: 'Cancel this booking?', label: 'Yes, cancel it', danger: true, body: `This cancels ${b.full_name}'s confirmed booking on ${fmtDate(b.slot_date)} at ${fmtTime(b.slot_time)} and opens the slot. This can't be undone.` },
    complete: { status: 'completed', title: 'Mark as completed?', label: 'Yes, completed', body: 'The appointment is done.' },
    noshow:   { status: 'no_show',   title: 'Mark as no-show?', label: 'Yes, no-show', danger: true, body: `${b.full_name} did not show up. The slot will be opened.` },
  }
  const act = dlg && ACTIONS[dlg]

  async function runAction() {
    const patch = { status: act.status }
    if (dlg === 'confirm') {
      if (confirmAmt === '' || Number(confirmAmt) < 1) return setAmtTried(true)
      patch.dp_amount = Number(confirmAmt)
    }
    if (dlg === 'reject') patch.status_note = rejectNote.trim() || null
    setBusy(true); setErr('')
    let { error } = await supabase.from('bookings').update(patch).eq('id', b.id)
    if (error && dlg === 'reject' && /status_note/.test(error.message || '')) {
      // 14_reject_reason.sql not run yet: still reject, just without the reason
      delete patch.status_note
      ;({ error } = await supabase.from('bookings').update(patch).eq('id', b.id))
      if (!error) setErr('Rejected, but the reason wasn’t saved. Run 14_reject_reason.sql in Supabase to enable reasons.')
    }
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
        <div className="font-display text-3xl font-semibold">{b.full_name}</div>
        <div className="break-all font-mono text-4xl font-bold tracking-wider text-rose">{b.code}</div>
        <div><StatusBadge status={b.status} /></div>
        {b.status === 'rejected' && b.status_note && <p className="text-xs text-cream/70">Reason given: “{b.status_note}”</p>}
        <div className="text-lg">{fmtDateLong(b.slot_date)} · {fmtTime(b.slot_time)}</div>
        {b.status === 'awaiting_payment' && <div className="pt-1">⏳ <Countdown expiresAt={b.expires_at} onExpire={load} className="text-2xl" /> left to pay</div>}
      </Card>

      {b.age < 15 && <p className="rounded-xl border border-amber-300/50 bg-amber-400/10 p-3 text-sm text-amber-200">⚑ This client is under 15 ({b.age}). Please review before confirming.</p>}
      <ErrorText>{err}</ErrorText>

      {b.status === 'payment_submitted' && b.receipt_uploaded_at && (Date.now() - new Date(b.receipt_uploaded_at)) / 36e5 >= checkHours && (
        <p className="rounded-xl border border-peach/60 bg-peach/10 p-3 text-sm text-peach">⚠ This receipt has been waiting over {checkHours} hours. The slot stays held until you approve or reject it.</p>
      )}
      {b.status === 'awaiting_payment' && b.receipt_note && (
        <p className="rounded-xl border border-cream/20 bg-ink/40 p-3 text-sm">You asked for a new receipt: “{b.receipt_note}”. The client has until the timer ends.</p>
      )}
      {pending && (
        <div className="space-y-2">
          <Btn className="w-full" onClick={() => { setAmtTried(false); setDlg('confirm') }}>{b.receipt_path ? '✓ Approve booking' : '✓ Mark as paid (no receipt)'}</Btn>
          {b.status === 'payment_submitted' && (
            <Btn variant="ghost" className="w-full" onClick={() => { setAskReason(''); setAskTried(false); setAskOpen(true) }}>↺ Ask for a new receipt</Btn>
          )}
          <Btn variant="danger" className="w-full" onClick={() => { setRejectNote(''); setDlg('reject') }}>Reject booking</Btn>
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
        {ig && ig !== '-' ? <Btn as="a" variant="ghost" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer" className="gap-1.5"><IgIcon />Instagram</Btn> : <span />}
        {b.phone !== '-' && <Btn as="a" variant="ghost" href={`tel:${b.phone}`}>Call</Btn>}
        {b.phone !== '-' && <Btn as="a" variant="ghost" href={`sms:${b.phone}`}>Text</Btn>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">

      <Card className="space-y-1 text-sm">
        <h2 className="mb-1 font-semibold text-peach">Client form</h2>
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
      </Card>

      <Card className="!p-0">
        <Collapsible tone="flat" title="Edit booking details" sub="Name, contact, service, tier…" open={editOpen}
          onToggle={() => { if (!editOpen) { setEd({ name: b.full_name, ig: b.instagram === '-' ? '' : b.instagram, phone: b.phone === '-' ? '' : b.phone, age: b.age ? String(b.age) : '', svc: { service: b.service, length: b.length || '', removal: b.removal, tier: b.tier, intensive: b.intensive } }); setEdTried(false) } setEditOpen(!editOpen) }}>
          {ed && (() => {
            const se = serviceErrors(ed.svc)
            const nameErr = !ed.name.trim() ? 'Enter a name.' : ''
            const newPrice = calcPrice(ed.svc.service, SERVICES[ed.svc.service]?.ext ? ed.svc.length : null, ed.svc.removal, ed.svc.intensive && intensiveAllowed(ed.svc.service, ed.svc.tier, ed.svc.removal))
            return (
              <div className="space-y-3">
                <Field label="Name" error={edTried ? nameErr : ''}><input className={inputCls} value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Instagram"><input className={inputCls} value={ed.ig} onChange={(e) => setEd({ ...ed, ig: e.target.value })} autoCapitalize="none" /></Field>
                  <Field label="Age"><input className={inputCls} inputMode="numeric" value={ed.age} onChange={(e) => setEd({ ...ed, age: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></Field>
                </div>
                <Field label="Phone"><input className={inputCls} inputMode="tel" value={ed.phone} onChange={(e) => setEd({ ...ed, phone: e.target.value })} /></Field>
                <ServiceFields value={ed.svc} onChange={(svc) => setEd({ ...ed, svc })} errors={edTried ? se : {}} />
                {newPrice != null && newPrice !== b.estimated_price && <p className="text-sm text-peach">New estimate: {peso(newPrice)} (was {peso(b.estimated_price)})</p>}
                <Btn className="w-full" disabled={busy} onClick={async () => {
                  if (nameErr || Object.keys(se).length) return setEdTried(true)
                  setBusy(true); setErr('')
                  const ext = SERVICES[ed.svc.service].ext
                  const { error } = await supabase.from('bookings').update({
                    full_name: ed.name.trim(), instagram: ed.ig.trim() ? '@' + ed.ig.trim().replace(/^@/, '') : '-', phone: ed.phone.trim() || '-', age: ed.age ? Number(ed.age) : 0,
                    service: ed.svc.service, length: ext ? ed.svc.length : null, removal: ed.svc.removal, tier: Number(ed.svc.tier),
                    intensive: !!ed.svc.intensive && intensiveAllowed(ed.svc.service, ed.svc.tier, ed.svc.removal), estimated_price: newPrice,
                  }).eq('id', b.id)
                  setBusy(false)
                  if (error) return setErr('Could not save the changes.')
                  setEditOpen(false); load()
                }}>Save changes</Btn>
              </div>
            )
          })()}
        </Collapsible>
      </Card>

      <Card className="!p-0">
        <Collapsible tone="flat" title="Client history" sub={others.length ? `${others.length} other booking${others.length === 1 ? '' : 's'} · ${others.filter((o) => o.status === 'no_show').length} no-show` : 'First booking with this number / Instagram'}
          open={sec === 'client'} onToggle={() => setSec(sec === 'client' ? null : 'client')}>
          {others.length === 0 ? <EmptyState icon="✿" title="New client">No other bookings with this phone number or Instagram.</EmptyState> : (
            <div className="space-y-2">
              {(() => {
                const done = others.filter((o) => o.status === 'completed')
                const spent = done.reduce((s2, o) => s2 + (o.final_price ?? o.estimated_price), 0)
                return (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-ink/40 p-2"><div className="font-display text-xl">{done.length}</div>completed</div>
                    <div className="rounded-xl bg-ink/40 p-2"><div className="font-display text-xl">{others.filter((o) => ['no_show', 'cancelled'].includes(o.status)).length}</div>no-show / cancelled</div>
                    <div className="rounded-xl bg-ink/40 p-2"><div className="font-display text-xl">{peso(spent)}</div>spent</div>
                  </div>
                )
              })()}
              {others.map((o) => (
                <Link key={o.id} to={`/admin/booking/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-cream/10 p-2 text-sm">
                  <span>{fmtDate(o.slot_date)} · {fmtTime(o.slot_time)}</span><StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </Collapsible>
      </Card>
      </div>

      <div className="space-y-4">

      <Card className="space-y-3">
        <h2 className="font-semibold text-peach">Payment & price</h2>
        <div className="flex justify-between text-sm"><span className="text-cream/60">Estimated base total</span><span>{peso(b.estimated_price)}</span></div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-cream/60">Receipt</span>
          <span className={receipt ? 'font-semibold text-emerald-200' : 'text-cream/60'}>{receipt ? '✓ Uploaded' : 'Not uploaded'}</span>
        </div>
        {receipt && <Btn variant="soft" className="w-full" onClick={() => setView(0)}>🧾 View receipt</Btn>}
        <Field label="Final price (₱)" hint="Leave blank to use the estimate. Clients can see this.">
          <input className={inputCls} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={String(b.estimated_price)} />
        </Field>
        {(() => {
          const m = balanceOf(price, b.estimated_price, b.dp_amount)
          const savedDiffers = String(price) !== String(b.final_price ?? '')
          return (
            <div className="space-y-1.5 rounded-2xl border border-cream/15 bg-ink/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-cream/60">{m.usingEstimate ? 'Total (estimate)' : 'Final price'}</span><span>{peso(m.total)}</span></div>
              <div className="flex justify-between"><span className="text-cream/60">{b.dp_amount == null ? 'Downpayment' : b.status === 'confirmed' || b.status === 'completed' ? 'Downpayment (confirmed)' : 'Client says (check GCash)'}</span><span>{b.dp_amount != null ? `− ${peso(m.paid)}` : 'None yet'}</span></div>
              <div className="flex items-baseline justify-between border-t border-cream/10 pt-2">
                <span className="font-semibold">Left to pay</span>
                <span className="font-display text-2xl font-semibold text-rose">{b.balance_paid != null ? 'Paid ✓' : peso(m.left)}</span>
              </div>
              {savedDiffers && <p className="text-xs text-peach">Not saved yet: tap “Save price & note” so the client sees it.</p>}
            </div>
          )
        })()}
        {['confirmed', 'completed'].includes(b.status) && (b.balance_paid != null ? (
          <div className="flex items-center justify-between rounded-2xl border border-cream/30 bg-cream/10 p-3 text-sm">
            <span>✓ Balance paid {peso(b.balance_paid)}{b.balance_method ? ` · ${b.balance_method === 'gcash' ? 'GCash' : 'Cash'}` : ''}{b.balance_paid_at ? ` · ${fmtDate(b.balance_paid_at.slice(0, 10))}` : ''}</span>
            <button className="min-h-11 px-2 text-xs text-cream/60 underline" onClick={async () => {
              await supabase.from('bookings').update({ balance_paid: null, balance_method: null, balance_paid_at: null }).eq('id', b.id); load()
            }}>Undo</button>
          </div>
        ) : balOpen ? (
          <div className="anim-in space-y-2 rounded-2xl border border-cream/20 p-3">
            <Field label="Balance received (₱)" error={balTried && !(Number(bal.amount) > 0) ? 'Enter the amount received.' : ''}>
              <input className={inputCls} inputMode="numeric" value={bal.amount} onChange={(e) => setBal({ ...bal, amount: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {[['cash', 'Cash'], ['gcash', 'GCash']].map(([k, t]) => (
                <button key={k} type="button" onClick={() => setBal({ ...bal, method: k })} className={`min-h-11 rounded-xl border text-sm ${bal.method === k ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{t}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => setBalOpen(false)}>Cancel</Btn>
              <Btn disabled={busy} onClick={async () => {
                if (!(Number(bal.amount) > 0)) return setBalTried(true)
                setBusy(true)
                const { error } = await supabase.from('bookings').update({ balance_paid: Number(bal.amount), balance_method: bal.method, balance_paid_at: new Date().toISOString() }).eq('id', b.id)
                setBusy(false)
                if (error) return setErr('Could not save the balance payment.')
                setBalOpen(false); load()
              }}>Save</Btn>
            </div>
          </div>
        ) : (
          <Btn variant="ghost" className="w-full" onClick={() => { setBal({ amount: String(balanceOf(b.final_price, b.estimated_price, b.dp_amount).left || ''), method: 'cash' }); setBalTried(false); setBalOpen(true) }}>₱ Mark balance as paid</Btn>
        ))}
        <Field label="Private note" hint="Only you can see this. Clients never can."><textarea className={inputCls + ' min-h-20 py-2'} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn className="w-full" onClick={saveExtras}>Save price & note</Btn>
        {msg && <p className="text-center text-sm text-emerald-200">{msg}</p>}
      </Card>

      {isActive && <Reschedule b={b} onMoved={load} />}

      <Card className="!p-0">
        <Collapsible tone="flat" title="Change status" sub="Fix a mistake, e.g. undo a reject or no-show" open={fixOpen} onToggle={() => { setFixTo(''); setFixOpen(!fixOpen) }}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS).filter(([k]) => k !== b.status).map(([k, s2]) => (
                <button key={k} type="button" onClick={() => setFixTo(k)} className={`min-h-11 rounded-xl border px-2 text-sm ${fixTo === k ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{s2.label}</button>
              ))}
            </div>
            <Btn className="w-full" disabled={!fixTo} onClick={() => setFixAsk(true)}>{fixTo ? `Change to “${STATUS[fixTo].label}”` : 'Pick a status'}</Btn>
          </div>
        </Collapsible>
      </Card>

      {canDelete && (
        <Card className="space-y-2 border-red-400/30">
          <h2 className="font-semibold text-red-200">Delete from history</h2>
          <p className="text-xs text-cream/70">Permanently removes this booking, its receipt pictures and your private note. This can’t be undone.</p>
          <Btn variant="danger" className="w-full" onClick={() => { setDelText(''); setDelOpen(true) }}>Delete permanently</Btn>
        </Card>
      )}

      </div>
      </div>

      <ReceiptModal url={receipt} open={view != null} onClose={() => setView(null)} />
      {delOpen && (
        <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="rise-in w-full max-w-sm space-y-3 rounded-3xl border border-cream/20 bg-[#2a0612] p-5 shadow-2xl">
            <h3 className="font-display text-2xl font-semibold">Delete permanently?</h3>
            <p className="text-sm text-cream/80">{b.full_name}’s booking {b.code} and everything attached to it will be erased. Type <b>DELETE</b> to confirm.</p>
            <input className={inputCls} value={delText} onChange={(e) => setDelText(e.target.value)} autoCapitalize="characters" placeholder="DELETE" />
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => setDelOpen(false)} disabled={busy}>Go back</Btn>
              <Btn variant="danger" disabled={delText.trim().toUpperCase() !== 'DELETE' || busy} onClick={hardDelete}>{busy ? 'Deleting…' : 'Delete'}</Btn>
            </div>
          </div>
        </div>
      )}

      <Card className="!p-0">
        <Collapsible tone="flat" title="Booking history" sub={events[0] ? `Last: ${new Date(events[0].at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'No history yet'}
          open={histOpen} onToggle={() => setHistOpen(!histOpen)}>
          {events.length === 0 ? <p className="text-sm text-cream/60">Nothing recorded yet. History starts from this update onward.</p> : (
            <ol className="space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-cream/20 pl-3">
                  <div className="text-xs text-cream/50">{new Date(e.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} · {e.actor === 'nailtech' ? 'You' : e.actor === 'system' ? 'Automatic' : 'Client'}</div>
                  <div>{prettyEvent(e)}</div>
                </li>
              ))}
            </ol>
          )}
        </Collapsible>
      </Card>

      {askOpen && (
        <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="rise-in w-full max-w-sm space-y-3 rounded-3xl border border-cream/20 bg-[#2a0612] p-5 shadow-2xl">
            <h3 className="font-display text-2xl font-semibold">Ask for a new receipt?</h3>
            <p className="text-sm text-cream/80">{b.full_name} keeps the slot and gets a few hours to upload a new receipt. They’ll see your reason on their booking page. If they don’t, the slot is released automatically.</p>
            <div className="flex flex-wrap gap-2">
              {['Amount doesn’t match', 'Receipt is unclear', 'Payment not found in my GCash', 'Sent to the wrong number'].map((r) => (
                <button key={r} type="button" onClick={() => setAskReason(r)} className={`min-h-9 rounded-full border px-3 text-xs ${askReason === r ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{r}</button>
              ))}
            </div>
            <Field label="Reason (shown to the client)" error={askTried && !askReason.trim() ? 'Please give a short reason.' : ''}>
              <input className={inputCls} value={askReason} maxLength={120} onChange={(e) => setAskReason(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => setAskOpen(false)} disabled={busy}>Go back</Btn>
              <Btn disabled={busy} onClick={async () => {
                if (!askReason.trim()) return setAskTried(true)
                setBusy(true); setErr('')
                const { error } = await supabase.rpc('request_new_receipt', { p_id: b.id, p_reason: askReason.trim() })
                setBusy(false); setAskOpen(false)
                if (error) return setErr('Could not send that. Please try again.')
                load()
              }}>{busy ? 'Please wait…' : 'Send'}</Btn>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={fixAsk} busy={busy} title="Change status?" confirmLabel="Yes, change it"
        body={fixTo ? `${b.full_name}: ${STATUS[b.status]?.label} → ${STATUS[fixTo].label}.${ACTIVE.includes(fixTo) && !ACTIVE.includes(b.status) ? ' The slot will be held for this booking again.' : ''}` : ''}
        onConfirm={async () => {
          setBusy(true); setErr('')
          const patch = { status: fixTo }
          if (fixTo === 'awaiting_payment') patch.expires_at = new Date(Math.min(Date.now() + 12 * 36e5, new Date(`${b.slot_date}T${b.slot_time.slice(0, 8)}+08:00`).getTime())).toISOString()
          const { error } = await supabase.from('bookings').update(patch).eq('id', b.id)
          setBusy(false); setFixAsk(false)
          if (error) return setErr(error.code === '23505' ? 'Another booking already holds this time. Move one of them first.' : 'Could not change the status.')
          setFixOpen(false); load()
        }} onCancel={() => setFixAsk(false)} />
      <ConfirmDialog open={!!act} title={act?.title} body={act?.body} confirmLabel={act?.label} danger={act?.danger} busy={busy}
        onConfirm={runAction} onCancel={() => setDlg(null)} />
    </div>
  )
}
