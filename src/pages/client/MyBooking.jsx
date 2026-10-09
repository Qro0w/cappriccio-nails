import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CANCEL_CUTOFF_HOURS, IG_HANDLE, IG_URL, REMOVALS, SERVICES } from '../../lib/config'
import { REMINDERS } from '../../lib/content'
import { cleanPhone, fmtDateLong, fmtTime, hoursUntil, peso } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, Shell, StatusBadge, inputCls } from '../../components/ui'
import Countdown from '../../components/Countdown'

const STORE = 'cpn_booking'
const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORE)) } catch { return null } }

function LookupForm({ onFound, notFound }) {
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <Card className="space-y-3">
      <h1 className="font-display text-3xl font-bold">Find my booking</h1>
      <p className="text-sm text-cream/70">Enter the booking code you were given and the phone number you booked with.</p>
      <Field label="Booking code"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CPN-XXXXX" autoCapitalize="characters" /></Field>
      <Field label="Phone number"><input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX XXX XXXX" /></Field>
      {notFound && <ErrorText>We couldn’t find a booking with those details. Please double-check them.</ErrorText>}
      <Btn className="w-full" disabled={!code.trim() || !phone.trim()} onClick={() => onFound({ code: code.trim(), phone: cleanPhone(phone) })}>Find booking</Btn>
      <Btn as={Link} to="/book" variant="ghost" className="w-full">Make a new booking</Btn>
    </Card>
  )
}

function PaymentBox({ b, cfg, onDone }) {
  const [file, setFile] = useState(null)
  const [amount, setAmount] = useState(cfg?.min_dp || 400)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [qrBad, setQrBad] = useState(false)
  const min = Number(cfg?.min_dp || 400)

  async function upload() {
    setBusy(true); setErr('')
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${b.code}/${Date.now()}.${ext}`
    const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); return setErr('Upload failed. Please use a JPG/PNG screenshot under 5 MB and try again.') }
    const { error } = await supabase.rpc('submit_receipt', { p_code: b.code, p_phone: readSaved()?.phone || b.phone, p_path: path, p_amount: Number(amount) })
    setBusy(false)
    if (error) return setErr(error.message.includes('AMOUNT_TOO_LOW') ? `The minimum downpayment is ${peso(min)}.` : 'Could not save your receipt. Your slot may have expired. Please refresh.')
    setFile(null)
    onDone()
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-peach">{b.receipt_uploaded ? 'Receipt received' : 'Send your downpayment'}</h2>
      {b.receipt_uploaded && <p className="text-sm text-emerald-200">Thank you! I’ll confirm your payment soon. You can upload another screenshot below if needed.</p>}
      <ol className="list-decimal space-y-1 pl-5 text-[13px] text-cream/85">
        <li>Send at least <b>{peso(min)}</b> (you may pay more) via GCash to the number below or scan the QR.</li>
        <li>Screenshot your GCash receipt.</li>
        <li>Upload it here{b.status === 'awaiting_payment' ? ' before the timer runs out' : ''}.</li>
      </ol>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-ink/50 p-3">
        <div>
          <div className="text-xs text-cream/60">GCash · {cfg?.gcash_name}</div>
          <div className="text-lg font-semibold tracking-wide">{cfg?.gcash_number}</div>
        </div>
        <Btn variant="ghost" className="!min-h-10 text-sm" onClick={() => navigator.clipboard?.writeText((cfg?.gcash_number || '').replace(/\s/g, ''))}>Copy</Btn>
      </div>
      {qrBad ? (
        <div className="flex aspect-square max-w-48 items-center justify-center rounded-xl bg-ink/50 text-xs text-cream/40">GCash QR (coming soon)</div>
      ) : (
        <img src="/gcash-qr.png" alt="GCash QR code" onError={() => setQrBad(true)} className="max-w-48 rounded-xl bg-white p-2" />
      )}
      <Field label="Upload receipt screenshot"><input type="file" accept="image/*" className={inputCls + ' py-2.5'} onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
      <Field label="Amount sent (₱)"><input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
      <ErrorText>{err}</ErrorText>
      <Btn className="w-full" disabled={!file || busy || Number(amount) < min} onClick={upload}>{busy ? 'Uploading…' : 'Submit receipt'}</Btn>
    </Card>
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
    ['Name', b.full_name], ['Instagram', b.instagram], ['Phone', b.phone], ['Age', b.age],
    ['Service', SERVICES[b.service].label + (b.length ? ` (${b.length})` : '')],
    ['Removal', REMOVALS[b.removal].label], ['Design tier', `Tier ${b.tier}`],
    ...(b.intensive ? [['Add-on', 'Intensive Manicure']] : []),
  ]

  return (
    <Shell>
      <div className="space-y-4">
        <Card className="space-y-2 text-center">
          <div className="text-xs text-cream/60">Booking code</div>
          <div className="font-mono text-2xl font-bold tracking-widest text-rose">{b.code}</div>
          <div><StatusBadge status={b.status} /></div>
          <div className="font-display text-2xl font-bold">{fmtDateLong(b.slot_date)}</div>
          <div className="text-lg">{fmtTime(b.slot_time)}</div>
        </Card>

        {awaiting && (
          <Card className="space-y-1 border-amber-300/40 text-center">
            <div className="text-sm text-amber-100">Your slot is held for you for</div>
            <Countdown expiresAt={b.expires_at} onExpire={load} className="text-4xl" />
            <div className="text-xs text-cream/70">Upload your downpayment receipt before this runs out, or the slot is released to others.</div>
          </Card>
        )}
        {dead && (
          <Card className="space-y-2 text-center">
            <p className="text-sm">{b.status === 'expired' ? 'The 12-hour downpayment window ended, so this slot was released.' : 'This booking is no longer active.'}</p>
            <Btn as={Link} to="/book" className="w-full">Book again</Btn>
          </Card>
        )}
        {open && cfg && <PaymentBox b={b} cfg={cfg} onDone={load} />}

        {(b.status === 'confirmed' || b.status === 'completed') && (
          <Card className="space-y-2">
            <h2 className="font-semibold text-peach">You’re confirmed! 💅</h2>
            {b.location && <p className="text-sm"><b>Location:</b> {b.location}</p>}
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-cream/85">{REMINDERS.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>
        )}

        {!dead && b.status !== 'completed' && (
          <Card className="space-y-2 text-sm">
            <p>💬 Please send your design inspo to <b>{IG_HANDLE}</b> on Instagram for your full quotation.</p>
            <Btn as="a" href={IG_URL} target="_blank" rel="noreferrer" variant="soft" className="w-full">Message on Instagram</Btn>
          </Card>
        )}

        <Card className="space-y-1 text-sm">
          <h2 className="mb-1 font-semibold text-peach">Booking details</h2>
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
          <div className="flex justify-between border-t border-cream/10 pt-2"><span className="text-cream/60">Estimated base total</span><span>{peso(b.estimated_price)}</span></div>
          {b.final_price != null && <div className="flex justify-between font-semibold"><span>Final price</span><span className="text-rose">{peso(b.final_price)}</span></div>}
          {b.dp_amount != null && <div className="flex justify-between"><span className="text-cream/60">Downpayment sent</span><span>{peso(b.dp_amount)}</span></div>}
          <p className="pt-1 text-xs text-cream/60">The estimate may change based on your exact design. The final price is set by the nailtech.</p>
        </Card>

        {(open || b.status === 'confirmed') && (
          <Card className="space-y-2 text-sm">
            <h2 className="font-semibold text-peach">Need to change something?</h2>
            <p className="text-cream/80">To reschedule, please message me on Instagram.</p>
            {cancellable ? (
              <Btn variant="ghost" className="w-full" onClick={() => setAskCancel(true)}>Cancel my booking</Btn>
            ) : (
              <p className="text-xs text-cream/70">Online cancellation closes {CANCEL_CUTOFF_HOURS} hours before your appointment. Cancelling within 72 hours forfeits your downpayment; within 48 hours or on the day means paying in full. Please message me on Instagram.</p>
            )}
            <ErrorText>{msg}</ErrorText>
          </Card>
        )}
        <div className="text-center"><button onClick={forget} className="text-xs text-cream/50 underline">Not you? Look up a different booking</button></div>
      </div>
      <ConfirmDialog open={askCancel} danger busy={busy} title="Cancel this booking?" confirmLabel="Yes, cancel it"
        body="Your downpayment is non-refundable. Your slot will be released to other clients. This can’t be undone." onConfirm={cancel} onCancel={() => setAskCancel(false)} />
    </Shell>
  )
}
