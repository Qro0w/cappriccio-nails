import { useState } from 'react'
import { RATES, SERVICE_GROUPS } from '../lib/content'
import Collapsible from './Collapsible'
import Rich from './Rich'

// "Short ········ ₱580" like the rate cards on her Instagram
function Row({ label, price }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span>{label}</span>
      <span className="flex-1 -translate-y-1 border-b border-dotted border-cream/30" />
      <span className="font-semibold text-rose">₱{price}</span>
    </div>
  )
}
function RateBlock({ head, rows }) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-display text-lg font-bold italic text-peach">{head}</h3>
      {rows.map(([l, p]) => <Row key={l} label={l} price={p} />)}
    </div>
  )
}

export function RatesTable() {
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-cream/20 bg-plum/55 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">Base Rates</h2>
        {RATES.base.map((b) => <RateBlock key={b.head} {...b} />)}
      </section>
      <section className="space-y-4 rounded-2xl border border-cream/20 bg-plum/55 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">Removals</h2>
        {RATES.removals.map((b) => <RateBlock key={b.head} {...b} />)}
        <div className="space-y-1 border-t border-cream/10 pt-3 text-xs text-cream/70">
          {RATES.notes.map((n) => <p key={n}><Rich text={n} /></p>)}
        </div>
      </section>
    </div>
  )
}

// Collapsible AND selectable: tap the circle to choose, tap the row to read about it.
// `selected` is the service key (biab|hardgel|softgel|hardgele); the add-on is chosen elsewhere.
export default function ServicePicker({ selected, onSelect }) {
  const [open, setOpen] = useState(null)
  return (
    <div className="space-y-5">
      {SERVICE_GROUPS.filter((g) => g.items.some((s) => s.key)).map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">{g.title}</h2>
          {g.intro && <p className="text-[13px] leading-snug text-cream/75"><Rich text={g.intro} /></p>}
          {g.items.map((s) => {
            const on = selected === s.key
            return (
              <div key={s.key} className={`flex items-start gap-1 rounded-2xl border ${on ? 'border-cream bg-cream/[0.06]' : 'border-cream/20 bg-plum/55'}`}>
                <button type="button" aria-label={`Select ${s.name}`} aria-pressed={on} onClick={() => onSelect(on ? '' : s.key)}
                  className="flex size-14 shrink-0 items-center justify-center">
                  <span className={`flex size-6 items-center justify-center rounded-full border text-xs ${on ? 'border-cream bg-cream text-ink' : 'border-cream/40'}`}>{on ? '✓' : ''}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <Collapsible tone="flat" title={s.name} right={<span className="text-xs text-rose">{s.price}</span>}
                    open={open === s.key} onToggle={() => setOpen(open === s.key ? null : s.key)}>
                    <div className="space-y-2 text-[13px] leading-snug text-cream/80">
                      <p><Rich text={s.text} /></p>
                      {s.rec.length > 0 && (
                        <div>
                          <p className="text-cream/60">{s.recHeader}</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.rec.map((r) => <li key={r}><Rich text={r} /></li>)}</ul>
                        </div>
                      )}
                    </div>
                  </Collapsible>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
