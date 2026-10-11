import { useEffect, useRef, useState } from 'react'
import { POLICIES } from '../lib/content'
import { Btn } from './ui'
import Rich, { RichList } from './Rich'

const short = (t) => t.split(/\s+(?:and|&)\s+/i)[0]
const ORD = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

// Policies shown one part per screen: progress bar ("1 of 4"), Back / Next.
// gate = true: tick + "Agree & continue" appear on the last part.
export function PolicyStepper({ policies = POLICIES, gate = false, onAgree }) {
  const [i, setI] = useState(0)
  const [seen, setSeen] = useState(() => new Set([0]))
  const [ok, setOk] = useState(false)
  const [nag, setNag] = useState('')
  const top = useRef(null)
  const first = useRef(true)
  const n = policies.length
  const g = policies[Math.min(i, n - 1)]
  const last = i === n - 1
  const all = seen.size >= n

  useEffect(() => {
    if (first.current) { first.current = false; return }
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [i])

  const go = (k) => { setI(k); setSeen((s) => new Set(s).add(k)); setNag('') }
  function agree() {
    if (!all) return setNag(`Please go through every part first (${seen.size}/${n} read).`)
    if (!ok) return setNag('Please tick “I have read and agree to the Policies”.')
    onAgree()
  }
  if (!g) return null

  return (
    <div className="space-y-4">
      <div ref={top} className="scroll-mt-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-cream/10">
            <div className="h-full rounded-full bg-rose transition-[width] duration-500 ease-out" style={{ width: `${((i + 1) / n) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs text-cream/60">{i + 1} of {n}</span>
        </div>
      </div>

      <article key={i} className="anim-in rounded-3xl border border-cream/15 bg-plum/55 px-5 py-6 backdrop-blur">
        <div className="font-display italic text-rose">Part {ORD[i] || i + 1}</div>
        <h2 className="mt-1 font-display text-[1.7rem] leading-tight">{g.title}</h2>
        {g.teaser && (
          <div className="my-4 rounded-2xl bg-rose/10 px-4 py-3 text-center font-display text-lg leading-snug text-rose">{g.teaser}</div>
        )}
        <div className={g.teaser ? '' : 'mt-4'}><RichList items={g.items} /></div>
        {g.footnote && <p className="mt-3 text-xs text-cream/70"><Rich text={g.footnote} /></p>}
      </article>

      <div className="sticky bottom-3 z-10 space-y-3 rounded-2xl border border-cream/10 bg-ink/95 p-3 backdrop-blur">
        {gate && last && (
          <>
            <label className={`flex items-start gap-3 ${all ? '' : 'opacity-40'}`}>
              <input type="checkbox" disabled={!all} checked={ok} onChange={(e) => { setOk(e.target.checked); setNag('') }} className="mt-0.5 size-6 shrink-0 accent-rose" />
              <span className="text-sm">I have read and agree to the Policies.</span>
            </label>
          </>
        )}
        {nag && <p role="alert" className="text-center text-xs font-semibold text-red-300">{nag}</p>}
        <div className="flex gap-2">
          {i > 0 && <Btn variant="ghost" className="shrink-0 px-6" onClick={() => go(i - 1)}>Back</Btn>}
          {!last && <Btn className="min-w-0 flex-1" onClick={() => go(i + 1)}><span className="truncate">Next: {short(policies[i + 1].title)} →</span></Btn>}
          {last && gate && <Btn className="flex-1" onClick={agree}>Agree & continue</Btn>}
        </div>
      </div>
    </div>
  )
}

// Read-only (the "View policies" page and the admin preview)
export function PolicySections({ policies = POLICIES }) {
  return <PolicyStepper policies={policies} />
}

// Shown ONCE per client (until the policies change).
export default function PolicyGate({ onAgree, onBack, policies = POLICIES, intro }) {
  return (
    <div className="space-y-4 pb-4">
      {onBack}
      <div>
        <h1 className="font-display text-3xl font-semibold">Policies</h1>
        {intro && <p className="mt-2 text-sm text-cream/80">{intro}</p>}
      </div>
      <PolicyStepper policies={policies} gate onAgree={onAgree} />
    </div>
  )
}
