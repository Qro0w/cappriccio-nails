import { useState } from 'react'
import { POLICIES, POLICY_INTRO } from '../lib/content'
import { Btn } from './ui'
import Collapsible from './Collapsible'
import Rich, { RichList } from './Rich'

function Body({ g }) {
  return (
    <>
      <RichList items={g.items} />
      {g.footnote && <p className="mt-3 text-xs text-cream/70"><Rich text={g.footnote} /></p>}
    </>
  )
}

// Read-only list of all policy sections (the "View policies" page)
export function PolicySections({ policies = POLICIES }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-3">
      {policies.map((g, i) => (
        <Collapsible key={g.title} title={g.title} sub={g.teaser} open={open === i} onToggle={() => setOpen(open === i ? null : i)}>
          <Body g={g} />
        </Collapsible>
      ))}
    </div>
  )
}

// Shown ONCE per client (until the policies change). Every section must be opened before agreeing.
export default function PolicyGate({ onAgree, onBack, policies = POLICIES }) {
  const [open, setOpen] = useState(0)
  const [seen, setSeen] = useState(() => new Set([0]))
  const [ok, setOk] = useState(false)
  const [nag, setNag] = useState('')
  const all = seen.size === policies.length
  function agree() {
    if (!all) return setNag(`Please open every policy section first (${seen.size}/${policies.length} read).`)
    if (!ok) return setNag('Please tick “I have read and agree to the Policies”.')
    onAgree()
  }

  function toggle(i) {
    setOpen(open === i ? null : i)
    setSeen((s) => new Set(s).add(i)); setNag('')
  }

  return (
    <div className="space-y-4 pb-4">
      {onBack}
      <h1 className="font-display text-3xl font-semibold">Policies</h1>
      <p className="text-sm text-cream/80">{POLICY_INTRO}</p>
      <div className="space-y-3">
        {policies.map((g, i) => (
          <Collapsible key={g.title} title={g.title} sub={g.teaser} open={open === i} onToggle={() => toggle(i)}
            right={seen.has(i) && open !== i ? <span className="font-bold text-rose">✓</span> : null}>
            <Body g={g} />
            {i < policies.length - 1 && (
              <Btn variant="ghost" className="mt-4 w-full !min-h-11 text-sm" onClick={() => toggle(i + 1)}>Next: {policies[i + 1].title}</Btn>
            )}
          </Collapsible>
        ))}
      </div>
      <div className="sticky bottom-3 space-y-3 rounded-2xl border border-rose/40 bg-ink/95 p-3 backdrop-blur">
        {!all && <p className="text-center text-xs text-cream/70">Open each section to continue ({seen.size}/{policies.length})</p>}
        <label className={`flex items-start gap-3 ${all ? '' : 'opacity-40'}`}>
          <input type="checkbox" disabled={!all} checked={ok} onChange={(e) => { setOk(e.target.checked); setNag('') }} className="mt-0.5 size-6 shrink-0 accent-rose" />
          <span className="text-sm">I have read and agree to the Policies.</span>
        </label>
        {nag && <p role="alert" className="text-center text-xs font-semibold text-red-300">{nag}</p>}
        <Btn className="w-full" onClick={agree}>Agree & continue</Btn>
      </div>
    </div>
  )
}
