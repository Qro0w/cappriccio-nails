import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Card, ErrorText, Field, inputCls } from '../../components/ui'

const FIELDS = [
  ['gcash_number', 'GCash number', 'Shown to clients after they book'],
  ['gcash_name', 'GCash account name', ''],
  ['min_dp', 'Minimum downpayment (₱)', ''],
]

export default function Settings() {
  const [v, setV] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => setV(Object.fromEntries((data || []).map((r) => [r.key, r.value]))))
  }, [])
  if (!v) return <p className="text-center text-cream/60">Loading…</p>

  async function save() {
    setMsg(''); setErr('')
    const rows = Object.entries(v).filter(([key]) => key !== 'hold_hours').map(([key, value]) => ({ key, value: String(value) }))
    const { error } = await supabase.from('settings').upsert(rows)
    if (error) setErr('Could not save.')
    else setMsg('Saved ✓')
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <Card className="space-y-3">
        {FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}><input className={inputCls} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
        <Field label="Location message" hint="Only shown to clients AFTER you confirm their payment">
          <textarea className={inputCls + ' min-h-24 py-2'} value={v.location_text ?? ''} onChange={(e) => setV({ ...v, location_text: e.target.value })} />
        </Field>
        <p className="text-xs text-cream/60">Clients have a fixed 12 hours from reserving to pay the downpayment.</p>
        <ErrorText>{err}</ErrorText>
        <Btn className="w-full" onClick={save}>Save settings</Btn>
        {msg && <p className="text-center text-sm text-emerald-200">{msg}</p>}
      </Card>
    </div>
  )
}
