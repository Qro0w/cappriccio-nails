import { useState } from 'react'
import { POLICIES } from '../lib/content'
import { Btn, Card } from './ui'

export default function PolicyGate({ onAgree }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="space-y-3">
      <h1 className="font-display text-3xl font-bold">Before you book</h1>
      <p className="text-sm text-cream/70">Please read these so there are no surprise fees on the day.</p>
      {POLICIES.map((g, i) => (
        <Card key={g.title} className="!p-0">
          <details open={i < 2} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold text-peach">
              {g.title}<span className="text-cream/50 transition group-open:rotate-180">⌄</span>
            </summary>
            <ul className="list-disc space-y-1.5 px-8 pb-4 text-[13px] leading-snug text-cream/85">
              {g.items.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </details>
        </Card>
      ))}
      <label className="flex items-start gap-3 rounded-2xl border border-rose/40 bg-ink/50 p-4">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-rose" />
        <span className="text-sm">I have read and agree to the rules and policies above.</span>
      </label>
      <Btn className="w-full" disabled={!ok} onClick={onAgree}>Continue</Btn>
    </div>
  )
}
