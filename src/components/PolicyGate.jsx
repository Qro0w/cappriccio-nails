import { useState } from 'react'
import { POLICIES, POLICY_INTRO } from '../lib/content'
import { Btn } from './ui'
import Collapsible from './Collapsible'
import Rich, { RichList } from './Rich'

// Read-only list of all policy sections (used on the Policies page and inside the gate)
export function PolicySections({ openFirst = true }) {
  const [open, setOpen] = useState(openFirst ? 0 : null)
  return (
    <div className="space-y-3">
      {POLICIES.map((g, i) => (
        <Collapsible key={g.title} title={g.title} sub={g.teaser} open={open === i} onToggle={() => setOpen(open === i ? null : i)}>
          <RichList items={g.items} />
          {g.footnote && <p className="mt-3 text-xs text-cream/70"><Rich text={g.footnote} /></p>}
        </Collapsible>
      ))}
    </div>
  )
}

// Shown ONCE per client (until the policies change). Sections are open for reading, one tick to agree.
export default function PolicyGate({ onAgree, onBack }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="space-y-4 pb-4">
      {onBack}
      <h1 className="font-display text-3xl font-bold">Policies</h1>
      <p className="text-sm text-cream/80">{POLICY_INTRO}</p>
      <PolicySections />
      <div className="sticky bottom-3 space-y-3 rounded-2xl border border-rose/40 bg-ink/95 p-3 backdrop-blur">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-rose" />
          <span className="text-sm">I have read and agree to the Policies.</span>
        </label>
        <Btn className="w-full" disabled={!ok} onClick={onAgree}>Agree & continue</Btn>
      </div>
    </div>
  )
}
