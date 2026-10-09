import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, publicUrl } from '../../lib/supabase'
import { compressImage } from '../../lib/image'
import { addMinutes, format } from 'date-fns'
import { CANCEL_CUTOFF_HOURS, IG_DM_URL, IG_HANDLE, REMOVALS, SERVICES } from '../../lib/config'
import { AFTER_RESERVE, CHANGE_LINES, reminders } from '../../lib/content'
import { cleanPhone, fmtDateLong, fmtTime, hoursUntil, peso, uid } from '../../lib/format'
import { BackLink, Btn, Card, ConfirmDialog, CopyButton, ErrorText, Field, Shell, StatusBadge, inputCls } from '../../components/ui'
import Lightbox from '../../components/Lightbox'
import Rich from '../../components/Rich'
import Countdown from '../../components/Countdown'
import Collapsible from '../../components/Collapsible'
import { RichList } from '../../components/Rich'

const STORE = 'cpn_booking'
const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORE)) } catch { return null } }

function LookupForm({ onFound, notFound }) {
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <Card className="space-y-3">
      <BackLink to="/">Back</BackLink>
      <h1 className="font-display text-3xl font-bold">Find my booking</h1>
      <p className="text-sm text-cream/70">Enter the booking code you were given and the phone number you booked with.</p>
      <Field label="Booking code"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CPN-XXXXX" autoCapitalize="characters" /></Field>
      <Field label="Phone number"><input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX XXX XXXX" /></Field>
      {notFound && <ErrorText>We couldn’t find a booking with those details. Please double-check them.</ErrorText>}
      <Btn className="w-full" disabled={!code.trim() || !phone.trim()} onClick={() => onFound({ code: code.trim(), phone: cleanPhone(phone) })}>Find booking</Btn>
      <Btn as={Link} to="/book" variant="ghost" className="w-full">Make a new booking</Btn>
      <div className="text-center"><Link to="/forgot-code" className="inline-block min-h-11 text-sm text-peach underline">Forgot my booking code</Link></div>
    </Card>
  )
}

function PaymentBox({ b, cfg, phone, onDone }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [amount, setAmount] = useState(cfg?.min_dp || 400)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [qrBad, setQrBad] = useState(false)
  const [view, setView] = useState(null)
  const min = Number(cfg?.min_dp || 400)
  const current = b.receipt_path ? publicUrl('receipts', b.receipt_path) : null

  function pickFile(f) {
    setFile(f)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null })
  }

  async function upload() {
    setBusy(true); setErr('')
    const img = await compressImage(file)
    const path = `${b.code}/${uid()}.${img.ext}`
    const up = await supabase.storage.from('receipts').upload(path, img.blob, { contentType: img.type })
    if (up.error) { setBusy(false); return setErr('Upload failed. Please use a clear screenshot (JPG/PNG) and try again.') }
    const { error } = await supabase.rpc('submit_receipt', { p_code: b.code, p_phone: phone, p_path: path, p_amount: Number(amount) })
    setBusy(false)
    if (error) return setErr(error.message.includes('AMOUNT_TOO_LOW') ? `The minimum downpayment is ${peso(min)}.` : 'Could not save your receipt. Your slot may have expired. Please refresh.')
    pickFile(null)
    onDone()
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-peach">{b.receipt_uploaded ? 'Receipt received' : 'Send your downpayment'}</h2>
      {current && (
        <div className="space-y-2">
          <p className="text-sm text-emerald-200">Thank you! I’ll confirm your payment soon.</p>
          <button type="button" onClick={() => setView(0)} className="block w-full"><img src={current} alt="Your receipt" className="max-h-56 w-full rounded-xl bg-ink/60 object-contain" /></button>
          <Btn variant="ghost" className="w-full" onClick={() => setView(0)}>View my receipt</Btn>
        </div>
      )}
      <p className="text-[13px] text-cream/80">Minimum down payment of <b>{peso(min)}</b> (you may pay more) via GCash. Screenshot your receipt and upload it here.</p>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-ink/50 p-3">
        <div>
          <div className="text-xs text-cream/60">GCash · {cfg?.gcash_name}</div>
          <div className="text-lg font-semibold tracking-wide">{cfg?.gcash_number}</div>
        </div>
        <CopyButton text={(cfg?.gcash_number || '').replace(/\s/g, '')} />
      </div>
      {qrBad ? (
        <div className="flex aspect-square max-w-48 items-center justify-center rounded-xl bg-ink/50 text-xs text-cream/40">GCash QR (coming soon)</div>
      ) : (
        <img src="/gcash-qr.png" alt="GCash QR code" onError={() => setQrBad(true)} className="max-w-48 rounded-xl bg-white p-2" />
      )}
      <Field label={b.receipt_uploaded ? 'Upload a different receipt' : 'Upload receipt screenshot'}>
        <input type="file" accept="image/*" className={inputCls + ' py-2.5'} onChange={(e) => pickFile(e.target.files?.[0] || null)} />
      </Field>
      {preview && <img src={preview} alt="Receipt preview" className="max-h-56 w-full rounded-xl bg-ink/60 object-contain" />}
      <Field label="Amount sent (₱)"><input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
      <ErrorText>{err}</ErrorText>
      <Btn className="w-full" disabled={!file || busy || Number(amount) < min} onClick={upload}>{busy ? 'Uploading…' : 'Submit receipt'}</Btn>
      <Lightbox images={current ? [current] : []} index={view} onIndex={setView} onClose={() => setView(null)} />
    </Card>
  )
}

function ReceiptView({ b }) {
  const [view, setView] = useState(null)
  if (!b.receipt_path) return null
  const url = publicUrl('receipts', b.receipt_path)
  return (
    <>
      <Btn variant="ghost" className="w-full" onClick={() => setView(0)}>View my receipt</Btn>
      <Lightbox images={[url]} index={view} onIndex={setView} onClose={() => setView(null)} />
    </>
  )
}

export default function MyBooking() {
  const [creds, setCreds] = useState(readSaved)
  const [b, setB] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [askCancel, setAskCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sec, setSec] = useState('reminders')

  const load = useCallback(async () => {
    if (!creds) return
    const { data, error } = await supabase.rpc('lookup_booking', { p_code: creds.code, p_phone: creds.phone })
    if (error || !data) { setB(null); setNotFound(true); localStorage.removeItem(STORE); setCreds(null) }
    else { setB(data); setNotFound(false) }
  }, [creds])

  useEffect(() => { load() }, [load])
  useEffect(() => { supabase.rpc('get_public_settings').then(({ data }) => setCfg(data)) }, [])

  function found(c) { localStorage.setItem(STORE, JSON.stringify(c)); setCreds(c) }
  function forget() { localStorage.removeItem(STORE); setCreds(null); setB(null) }

  async function cancel() {
    setBusy(true)
    const { error } = await supabase.rpc('client_cancel', { p_code: b.code, p_phone: creds.phone })
    setBusy(false); setAskCancel(false)
    setMsg(error ? 'This booking can no longer be cancelled online. Please message me on Instagram.' : '')
    load()
  }

  if (!creds) return <Shell><LookupForm onFound={found} notFound={notFound} /></Shell>
  if (!b) return <Shell><p className="text-center text-cream/60">Loading your booking…</p></Shell>

  const awaiting = b.status === 'awaiting_payment'
  const open = awaiting || b.status === 'payment_submitted'
  const cancellable = (open || b.status === 'confirmed') && hoursUntil(b.slot_date, b.slot_time) > CANCEL_CUTOFF_HOURS
  const dead = ['expired', 'cancelled', 'rejected', 'no_show'].includes(b.status)
  const rows = [
    ['Name', b.full_name], ['Instagram handle', b.instagram], ['Phone number', b.phone], ['Age', b.age],
    ['Service', SERVICES[b.service].label + (b.length ? ` (${b.length})` : '')],
    ['Removal', REMOVALS[b.removal].label], ['Design tier level', `Tier ${b.tier}`],
    ...(b.intensive ? [['Add-on', 'Intensive Manicure']] : []),
  ]

  return (
    <Shell>
      <div className="space-y-4">
        <BackLink to="/">Home</BackLink>
        {!dead && (
          <div className="space-y-1 rounded-2xl border-2 border-red-400/70 bg-red-500/15 p-4 text-center">
            <div className="text-lg font-bold text-red-200">📸 SCREENSHOT THIS NOW</div>
            <p className="text-sm text-cream/90">Save your booking code. You need it to view your booking. Then send a screenshot of it, together with your design / inspo, to <b>{IG_HANDLE}</b>.</p>
          </div>
        )}
        <Card className="space-y-3 text-center">
          <div className="text-xs uppercase tracking-widest text-cream/60">Booking code</div>
          <div className="break-all font-mono text-[2.6rem] font-bold leading-none tracking-wider text-rose">{b.code}</div>
          <CopyButton text={b.code} label="Copy code" className="w-full" />
          <div><StatusBadge status={b.status} /></div>
          <div className="font-display text-2xl font-bold">{fmtDateLong(b.slot_date)}</div>
          <div className="text-lg">{fmtTime(b.slot_time)}</div>
        </Card>

        {awaiting && (
          <Card className="space-y-1 border-amber-300/40 text-center">
            <div className="text-xs text-amber-100">Time left to pay your down payment (72 hours from reserving)</div>
            <Countdown expiresAt={b.expires_at} onExpire={load} className="text-3xl" />
            <div className="text-xs text-cream/80"><Rich text="!!NO DOWNPAYMENT = NO APPOINTMENT.!!" /> Upload your receipt before the timer ends or the slot is released.</div>
          </Card>
        )}
        {dead && (
          <Card className="space-y-2 text-center">
            <p className="text-sm">{b.status === 'expired' ? 'The 72-hour downpayment window ended, so this slot was released.' : 'This booking is no longer active.'}</p>
            <Btn as={Link} to="/book" className="w-full">Book again</Btn>
          </Card>
        )}
        {open && cfg && <PaymentBox b={b} cfg={cfg} phone={creds.phone} onDone={load} />}

        {(b.status === 'confirmed' || b.status === 'completed') && (
          <Card className="space-y-3">
            <h2 className="font-semibold text-peach">Booking confirmed</h2>
            {b.location && <p className="whitespace-pre-line text-sm">{b.location}</p>}
            <Collapsible tone="flat" title="Additional reminders" open={sec === 'reminders'} onToggle={() => setSec(sec === 'reminders' ? null : 'reminders')}>
              <RichList items={reminders(format(addMinutes(new Date(`2000-01-01T${b.slot_time.slice(0, 8)}`), 15), 'h:mm a'))} />
            </Collapsible>
          </Card>
        )}

        {!dead && b.status !== 'completed' && (
          <Card className="space-y-2 text-sm">
            <p>{AFTER_RESERVE}</p>
            <Btn as="a" href={IG_DM_URL} target="_blank" rel="noreferrer" variant="soft" className="w-full">Message on Instagram</Btn>
          </Card>
        )}

        <Card className="space-y-1 text-sm">
          <h2 className="mb-1 font-semibold text-peach">Booking details</h2>
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
          <div className="flex justify-between border-t border-cream/10 pt-2"><span className="text-cream/60">Estimated base total</span><span>{peso(b.estimated_price)}</span></div>
          {b.final_price != null && <div className="flex justify-between font-semibold"><span>Final price</span><span className="text-rose">{peso(b.final_price)}</span></div>}
          {b.dp_amount != null && <div className="flex justify-between"><span className="text-cream/60">Downpayment sent</span><span>{peso(b.dp_amount)}</span></div>}
          {!open && b.receipt_path && <div className="pt-2"><ReceiptView b={b} /></div>}
        </Card>

        {(open || b.status === 'confirmed') && (
          <Card className="space-y-3">
            <h2 className="font-semibold text-peach">Reschedule or cancel</h2>
            <RichList items={CHANGE_LINES} />
            <p className="text-xs text-cream/70">To reschedule, please message me on Instagram.</p>
            {cancellable ? (
              <Btn variant="ghost" className="w-full" onClick={() => setAskCancel(true)}>Cancel my booking</Btn>
            ) : (
              <div className="space-y-2 rounded-xl border-2 border-red-400/70 bg-red-500/15 p-3">
                <p className="text-sm font-bold text-red-200">Your appointment is within {CANCEL_CUTOFF_HOURS / 24} days, so you can no longer cancel here.</p>
                <p className="text-[13px] text-cream/90">Please message me on Instagram. <Rich text="!!Cancelling this close to your appointment forfeits your down payment, and cancelling within 48 hours or on the day means paying in full.!!" /></p>
                <Btn as="a" href={IG_DM_URL} target="_blank" rel="noreferrer" variant="soft" className="w-full">Message {IG_HANDLE}</Btn>
              </div>
            )}
            <ErrorText>{msg}</ErrorText>
          </Card>
        )}
        <div className="text-center"><button onClick={forget} className="text-xs text-cream/50 underline">Not you? Look up a different booking</button></div>
      </div>
      <ConfirmDialog open={askCancel} danger busy={busy} title="Cancel this booking?" confirmLabel="Yes, cancel it"
        body="Cancelling forfeits your non-refundable down payment. Your slot will be released to other clients. This can’t be undone." onConfirm={cancel} onCancel={() => setAskCancel(false)} />
    </Shell>
  )
}
