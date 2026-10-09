import { useState } from 'react'
import { RATES, SERVICE_GROUPS } from '../lib/content'
import { Btn } from './ui'
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

export default function ServiceInfo({ onNext }) {
  const [tab, setTab] = useState('services')
  const [open, setOpen] = useState(null)
  const seg = (on) => `min-h-11 flex-1 rounded-lg text-sm font-semibold ${on ? 'bg-rose text-ink' : 'text-cream/70'}`

  return (
    <div className="space-y-4 pb-4">
      <h1 className="font-display text-3xl font-bold">{tab === 'services' ? 'Services' : 'Rates'}</h1>
      <div className="flex gap-1 rounded-xl bg-ink/60 p-1">
        <button className={seg(tab === 'services')} onClick={() => setTab('services')}>Services</button>
        <button className={seg(tab === 'rates')} onClick={() => setTab('rates')}>Rates</button>
      </div>

      {tab === 'services' && SERVICE_GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">{g.title}</h2>
          {g.intro && <p className="text-[13px] leading-snug text-cream/75"><Rich text={g.intro} /></p>}
          {g.items.map((s) => (
            <Collapsible key={s.name} title={s.name} right={<span className="text-xs text-rose">{s.price}</span>}
              open={open === s.name} onToggle={() => setOpen(open === s.name ? null : s.name)}>
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
          ))}
        </section>
      ))}

      {tab === 'rates' && (
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-cream/10 bg-wine/60 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">Base Rates</h2>
            {RATES.base.map((b) => <RateBlock key={b.head} {...b} />)}
          </section>
          <section className="space-y-4 rounded-2xl border border-cream/10 bg-wine/60 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cream/60">Removals</h2>
            {RATES.removals.map((b) => <RateBlock key={b.head} {...b} />)}
            <div className="space-y-1 border-t border-cream/10 pt-3 text-xs text-cream/70">
              {RATES.notes.map((n) => <p key={n}><Rich text={n} /></p>)}
            </div>
          </section>
        </div>
      )}

      <div className="sticky bottom-3 rounded-2xl bg-ink/90 p-2 backdrop-blur">
        <Btn className="w-full" onClick={onNext}>Start my booking</Btn>
      </div>
    </div>
  )
}
