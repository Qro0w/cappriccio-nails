import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { POLICIES } from '../../lib/content'
import { loadPublicSettings, policiesFrom } from '../../lib/publicSettings'
import { Btn, Card, ConfirmDialog, ErrorText, Field, inputCls } from '../../components/ui'
import { Skeleton } from '../../components/Feedback'
import { PolicySections } from '../../components/PolicyGate'

// Bullets as plain text: one per line; a line starting with "-" is a sub-point of the line above.
const toText = (items) => items.map((it) => (typeof it === 'string' ? it : [it.text, ...it.sub.map((x) => `- ${x}`)].join('\n'))).join('\n')
function fromText(text) {
  const out = []
  text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()).forEach((l) => {
    const m = l.match(/^\s*-\s*(.*)$/)
    if (m && out.length) {
      const last = out[out.length - 1]
      out[out.length - 1] = typeof last === 'string' ? { text: last, sub: [m[1]] } : { ...last, sub: [...last.sub, m[1]] }
    } else out.push(l.trim())
  })
  return out
}
const toEditable = (ps) => ps.map((g) => ({ title: g.title, teaser: g.teaser || '', footnote: g.footnote || '', body: toText(g.items) }))
const fromEditable = (es) => es.map((e) => ({ title: e.title.trim(), teaser: e.teaser.trim(), items: fromText(e.body), ...(e.footnote.trim() ? { footnote: e.footnote.trim() } : {}) }))

export default function PolicyEditor() {
  const [secs, setSecs] = useState(null)
  const [tried, setTried] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState(false)
  const [askReset, setAskReset] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadPublicSettings(true).then((c) => setSecs(toEditable(policiesFrom(c)))) }, [])
  if (!secs) return <Skeleton lines={4} />

  const set = (i, k, v) => { setSecs(secs.map((s, j) => (j === i ? { ...s, [k]: v } : s))); setMsg('') }
  const bad = secs.some((s) => !s.title.trim() || !s.body.trim())

  async function save(policies) {
    setBusy(true); setErr(''); setMsg('')
    const rows = [
      { key: 'policies_json', value: policies ? JSON.stringify(policies) : '' },
      { key: 'policy_version', value: policies ? `p${Date.now()}` : '' },
    ]
    const { error } = await supabase.from('settings').upsert(rows)
    setBusy(false)
    if (error) return setErr('Could not save. Please try again.')
    await loadPublicSettings(true)
    setMsg('Saved ✓ Clients will be asked to read and agree to the new policies next time they book.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/admin/settings" className="inline-flex min-h-11 items-center text-sm font-semibold text-peach">← Back to settings</Link>
      <h1 className="font-display text-3xl font-semibold">Edit policies</h1>
      <Card className="space-y-1 text-xs text-cream/70">
        <p>One bullet per line. Start a line with <b>-</b> to make it a sub-point of the line above.</p>
        <p>Emphasis: <b>**gold bold**</b> · <b className="text-red-300">!!red warning!!</b> · <i>//italic//</i> · <u>__underline__</u></p>
        <p>Lines that mention rescheduling or cancelling are also shown on each client’s booking page.</p>
      </Card>

      {secs.map((s, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Section {i + 1}</h2>
            {secs.length > 1 && <button className="min-h-11 px-2 text-sm text-red-300" onClick={() => setSecs(secs.filter((_, j) => j !== i))}>Remove</button>}
          </div>
          <Field label="Title" error={tried && !s.title.trim() ? 'Add a title.' : ''}><input className={inputCls} value={s.title} onChange={(e) => set(i, 'title', e.target.value)} /></Field>
          <Field label="Highlight line (optional)" hint="Shown big at the top of this part."><input className={inputCls} value={s.teaser} onChange={(e) => set(i, 'teaser', e.target.value)} /></Field>
          <Field label="Bullets" error={tried && !s.body.trim() ? 'Add at least one bullet.' : ''}>
            <textarea className={inputCls + ' min-h-48 py-2 text-sm leading-relaxed'} value={s.body} onChange={(e) => set(i, 'body', e.target.value)} />
          </Field>
          <Field label="Footnote (optional)"><input className={inputCls} value={s.footnote} onChange={(e) => set(i, 'footnote', e.target.value)} /></Field>
        </Card>
      ))}
      <Btn variant="ghost" className="w-full" onClick={() => setSecs([...secs, { title: '', teaser: '', footnote: '', body: '' }])}>＋ Add a section</Btn>

      <Btn variant="ghost" className="w-full" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview what clients see'}</Btn>
      {preview && <PolicySections policies={fromEditable(secs)} />}

      <ErrorText>{err}</ErrorText>
      {msg && <p className="rounded-2xl bg-cream/10 p-3 text-center text-sm text-cream">{msg}</p>}
      <Btn className="w-full" disabled={busy} onClick={() => (bad ? setTried(true) : save(fromEditable(secs)))}>{busy ? 'Saving…' : 'Save policies'}</Btn>
      <button className="w-full min-h-11 text-sm text-cream/60 underline" onClick={() => setAskReset(true)}>Reset to the original policies</button>
      <ConfirmDialog open={askReset} danger title="Reset policies?" confirmLabel="Reset"
        body="Your edits are replaced with the original policy text from the booking doc."
        onConfirm={async () => { setAskReset(false); await save(null); setSecs(toEditable(POLICIES)) }} onCancel={() => setAskReset(false)} />
    </div>
  )
}
