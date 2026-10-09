import { REMOVAL_RATES, SERVICE_INFO } from '../lib/content'
import { Btn, Card } from './ui'

export default function ServiceInfo({ onNext }) {
  return (
    <div className="space-y-3">
      <h1 className="font-display text-3xl font-bold">Services & rates</h1>
      {SERVICE_INFO.map((g) => (
        <Card key={g.group} className="space-y-3">
          <div>
            <h2 className="font-semibold text-peach">{g.group}</h2>
            {g.blurb && <p className="text-xs text-cream/70">{g.blurb}</p>}
          </div>
          {g.items.map((s) => (
            <div key={s.name} className="border-t border-cream/10 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                <span className="text-right text-xs text-rose">{s.rate}</span>
              </div>
              <p className="mt-1 text-[13px] text-cream/80">{s.text}</p>
              {s.rec.length > 0 && (
                <p className="mt-1 text-xs text-cream/60">Recommended for: {s.rec.join(' · ')}</p>
              )}
            </div>
          ))}
        </Card>
      ))}
      <Card className="space-y-1">
        <h2 className="font-semibold text-peach">Removals</h2>
        {REMOVAL_RATES.map(([n, p]) => (
          <div key={n} className="flex justify-between gap-2 text-[13px]"><span>{n}</span><span className="text-rose">{p}</span></div>
        ))}
        <p className="pt-1 text-xs text-cream/60">*Fills count as a removal. Structured mani fill is only for BIAB and Hard Gel mani.</p>
      </Card>
      <Btn className="w-full" onClick={onNext}>Start my booking</Btn>
    </div>
  )
}
