import Select from '../../components/Select'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, publicUrl } from '../../lib/supabase'
import { compressImage } from '../../lib/image'
import { uid } from '../../lib/format'
import { loadPublicSettings } from '../../lib/publicSettings'
import { Skeleton } from '../../components/Feedback'
import { Btn, Card, ErrorText, Field, inputCls } from '../../components/ui'
import PushCard from '../../components/PushCard'

const FIELDS = [
  ['gcash_number', 'GCash number', 'Shown to clients after they book'],
  ['gcash_name', 'GCash account name', ''],
  ['min_dp', 'Minimum downpayment (₱)', ''],
]

export default function Settings() {
  const [v, setV] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [qrBusy, setQrBusy] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => setV(Object.fromEntries((data || []).map((r) => [r.key, r.value]))))
  }, [])
  if (!v) return <Skeleton lines={5} />

  async function uploadQr(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('Please choose an image of your GCash QR.')
    setErr(''); setMsg(''); setQrBusy(true)
    const img = await compressImage(file, { maxDim: 1000, quality: 0.92 })
    const path = `site/gcash-qr-${uid()}.${img.ext}`
    const up = await supabase.storage.from('tier-photos').upload(path, img.blob, { contentType: img.type })
    if (up.error) { setQrBusy(false); return setErr('Could not upload the QR. Please try again.') }
    const old = v.gcash_qr_path
    const { error } = await supabase.from('settings').upsert({ key: 'gcash_qr_path', value: path })
    setQrBusy(false)
    if (error) return setErr('Could not save the QR.')
    if (old) supabase.storage.from('tier-photos').remove([old])
    setV({ ...v, gcash_qr_path: path }); loadPublicSettings(true); setMsg('QR updated ✓')
  }

  async function save() {
    setMsg(''); setErr('')
    if (v.map_url && !/^https?:\/\//.test(v.map_url)) return setErr('The Maps link should start with https://')
    for (const [k, label] of [['min_dp', 'Minimum downpayment'], ['resubmit_hours', 'Hours to upload a new receipt'], ['check_reminder_hours', 'Remind me after']]) {
      if (!/^\d+$/.test(String(v[k] ?? '')) || Number(v[k]) < 1) return setErr(`${label}: please enter a whole number.`)
    }
    const rows = Object.entries(v).filter(([key]) => !['hold_hours', 'gcash_qr_path', 'policies_json', 'policy_version', 'notify_secret'].includes(key)).map(([key, value]) => ({ key, value: String(value) }))
    const { error } = await supabase.from('settings').upsert(rows)
    if (error) setErr('Could not save.')
    else { setMsg('Saved ✓'); loadPublicSettings(true) }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <Card className="space-y-3">
        {FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}><input className={inputCls} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
        <Field label="GCash QR code" hint="Shown to clients on their booking page.">
          <div className="flex items-center gap-3">
            {v.gcash_qr_path
              ? <img src={publicUrl('tier-photos', v.gcash_qr_path)} alt="Your GCash QR" className="size-24 rounded-xl bg-white object-contain p-1" />
              : <div className="flex size-24 items-center justify-center rounded-xl border border-dashed border-cream/25 text-xs text-cream/50">No QR yet</div>}
            <label className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-rose/70 px-4 font-display ${qrBusy ? 'opacity-50' : ''}`}>
              {qrBusy ? 'Uploading…' : v.gcash_qr_path ? 'Replace QR' : 'Upload QR'}
              <input type="file" accept="image/*" className="hidden" disabled={qrBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadQr(f) }} />
            </label>
          </div>
        </Field>
        <Field label="Location message" hint="Only shown to clients AFTER you confirm their payment">
          <textarea className={inputCls + ' min-h-24 py-2'} value={v.location_text ?? ''} onChange={(e) => setV({ ...v, location_text: e.target.value })} />
        </Field>
        <Field label="Google Maps link (optional)" hint="Clients get an “Open in Maps” button after you approve them. Paste the Share link from Google Maps.">
          <input className={inputCls} value={v.map_url ?? ''} placeholder="https://maps.app.goo.gl/…" onChange={(e) => setV({ ...v, map_url: e.target.value.trim() })} />
        </Field>
        <p className="text-xs text-cream/60">Clients have a fixed 12 hours from reserving to pay the downpayment.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Booking safeguards</h2>
        <Field label="Stop client bookings for a day" hint="You can still book someone in yourself.">
          <Select value={v.cutoff_hours_before ?? '0'} onChange={(x) => setV({ ...v, cutoff_hours_before: x })} options={[
            { value: '0', label: 'When the day starts (midnight)' },
            { value: '3', label: '9 PM the night before' },
            { value: '6', label: '6 PM the night before' },
            { value: '12', label: 'Noon the day before' },
            { value: '24', label: 'Midnight the day before' },
          ]} />
        </Field>
        <Field label="Waiting bookings allowed per phone number" hint="Unpaid or not-yet-approved. Approved bookings don’t count.">
          <Select value={v.max_pending_per_phone ?? '2'} onChange={(x) => setV({ ...v, max_pending_per_phone: x })}
            options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: n }))} />
        </Field>
        <Field label="Hours to upload a new receipt" hint="When you tap “Ask for a new receipt”.">
          <input className={inputCls} inputMode="numeric" value={v.resubmit_hours ?? '6'} onChange={(e) => setV({ ...v, resubmit_hours: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Remind me about unchecked receipts after (hours)">
          <input className={inputCls} inputMode="numeric" value={v.check_reminder_hours ?? '12'} onChange={(e) => setV({ ...v, check_reminder_hours: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <ErrorText>{err}</ErrorText>
        <Btn className="w-full" onClick={save}>Save settings</Btn>
        {msg && <p className="text-center text-sm text-emerald-200">{msg}</p>}
      </Card>
      <PushCard />
      <Card className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Policies</h2>
          <p className="text-xs text-cream/60">Edit the policy text clients agree to.</p>
        </div>
        <Btn as={Link} to="/admin/policies" variant="ghost" className="!min-h-11 shrink-0 text-sm">Edit</Btn>
      </Card>
    </div>
  )
}
