import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseISO, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { IG_HANDLE, IG_URL, INTENSIVE_FEE, LENGTHS, REMOVALS, SERVICES, calcPrice, intensiveAllowed, removalOptions } from '../../lib/config'
import { TIER_NOTE } from '../../lib/content'
import { cleanIg, cleanPhone, fmtDate, fmtTime, peso, validPhone } from '../../lib/format'
import { Btn, Card, ErrorText, Field, Shell, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import PolicyGate from '../../components/PolicyGate'
import ServiceInfo from '../../components/ServiceInfo'

const EMPTY = { full_name: '', instagram: '', phone: '', age: '', service: '', length: '', removal: '', tier: '', intensive: false }

// Values that actually get used (length only for extensions, intensive only when allowed)
const effective = (f) => {
  const ext = SERVICES[f.service]?.ext
  const canIntensive = !!(f.service && f.tier && f.removal && intensiveAllowed(f.service, f.tier, f.removal))
  return { ext, length: ext ? f.length : null, canIntensive, intensive: canIntensive && f.intensive }
}

function TierPhoto({ n }) {
  const [bad, setBad] = useState(false)
  return bad ? (
    <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-ink/60 text-xs text-cream/40">Tier {n} photo</div>
  ) : (
    <img src={`/tiers/tier-${n}.jpg`} alt={`Tier ${n} design example`} onError={() => setBad(true)} className="aspect-[4/3] w-full rounded-lg object-cover" />
  )
}

function DetailsForm({ form, setForm, onNext, onBack }) {
  const set = (k, v) => setForm({ ...form, [k]: v })
  const e = effective(form)
  const price = calcPrice(form.service, e.length, form.removal, e.intensive)
  const ready =
    form.full_name.trim() && form.instagram.replace('@', '').trim() && validPhone(form.phone) &&
    Number(form.age) >= 1 && form.service && (!e.ext || form.length) && form.removal && form.tier

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-cream/60 underline">← Back</button>
      <h1 className="font-display text-3xl font-bold">Your details</h1>

      <Card className="space-y-3">
        <Field label="Full name"><input className={inputCls} value={form.full_name} onChange={(ev) => set('full_name', ev.target.value)} autoComplete="name" /></Field>
        <Field label="Instagram handle" hint="So I can find your messages, e.g. @yourname">
          <input className={inputCls} value={form.instagram} onChange={(ev) => set('instagram', ev.target.value)} autoCapitalize="none" placeholder="@yourname" />
        </Field>
        <Field label="Phone number" hint="09XX XXX XXXX">
          <input className={inputCls} inputMode="tel" value={form.phone} onChange={(ev) => set('phone', ev.target.value)} autoComplete="tel" placeholder="09XX XXX XXXX" />
        </Field>
        <Field label="Age">
          <input className={inputCls} inputMode="numeric" value={form.age} onChange={(ev) => set('age', ev.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Field>
        {Number(form.age) > 0 && Number(form.age) < 15 && (
          <p className="rounded-xl bg-amber-400/15 p-3 text-xs text-amber-200">Heads up: bookings for clients under 15 are flagged for the nailtech to review.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <Field label="Which nail service?">
          <select className={inputCls} value={form.service} onChange={(ev) => setForm({ ...form, service: ev.target.value, length: '', removal: '' })}>
            <option value="">Choose a service…</option>
            {Object.entries(SERVICES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </Field>
        {e.ext && (
          <Field label="What length?">
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => (
                <button key={l} onClick={() => set('length', l)}
                  className={`min-h-12 rounded-xl border capitalize ${form.length === l ? 'border-rose bg-rose text-ink' : 'border-cream/25'}`}>{l}</button>
              ))}
            </div>
          </Field>
        )}
        {form.service && (
          <Field label="Is removal needed?" hint="Please mention any existing enhancements. Not doing so adds ₱80 on top of removal fees.">
            <select className={inputCls} value={form.removal} onChange={(ev) => set('removal', ev.target.value)}>
              <option value="">Choose…</option>
              {removalOptions(form.service).map((k) => (
                <option key={k} value={k}>{REMOVALS[k].label}{REMOVALS[k].fee ? ` (+${peso(REMOVALS[k].fee)})` : ''}</option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-peach">Design tier</h2>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => set('tier', n)}
              className={`space-y-1 rounded-xl border p-1.5 text-left ${Number(form.tier) === n ? 'border-rose bg-rose/15' : 'border-cream/20'}`}>
              <TierPhoto n={n} />
              <div className="px-1 pb-1 text-sm font-semibold">Tier {n}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-cream/70">{TIER_NOTE}</p>
        {e.canIntensive && (
          <label className="flex items-center gap-3 rounded-xl border border-cream/20 p-3">
            <input type="checkbox" className="size-6 accent-rose" checked={form.intensive} onChange={(ev) => set('intensive', ev.target.checked)} />
            <span className="text-sm">Add Intensive Manicure <span className="text-rose">(+{peso(INTENSIVE_FEE)})</span></span>
          </label>
        )}
      </Card>

      {price != null && (
        <div className="rounded-2xl border border-rose/30 bg-ink/50 p-4 text-center">
          <div className="text-xs text-cream/60">Estimated base total</div>
          <div className="font-display text-3xl font-bold text-rose">{peso(price)}</div>
          <div className="text-xs text-cream/60">Your final price depends on your design. Message me for the exact price.</div>
        </div>
      )}
      <Btn className="w-full" disabled={!ready} onClick={onNext}>Choose date & time</Btn>
    </div>
  )
}

function SlotStep({ form, pick, setPick, onNext, onBack }) {
  const [slots, setSlots] = useState(null)
  const [err, setErr] = useState('')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(pick?.date || null)

  async function load() {
    setErr('')
    const { data, error } = await supabase.rpc('get_slots', { p_service: form.service, p_tier: Number(form.tier), p_removal: form.removal })
    if (error) return setErr('Could not load the schedule. Please try again.')
    setSlots(data)
    if (data.length && !pick) setMonth(startOfMonth(parseISO(data[0].slot_date)))
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const byDate = useMemo(() => {
    const m = {}
    ;(slots || []).forEach((s) => (m[s.slot_date] ||= []).push(s))
    return m
  }, [slots])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-cream/60 underline">← Back</button>
      <h1 className="font-display text-3xl font-bold">Pick a date & time</h1>
      <ErrorText>{err}</ErrorText>
      {!slots && !err && <p className="text-center text-cream/60">Loading the schedule…</p>}
      {slots && (
        <>
          <Card>
            <Calendar
              month={month} onMonth={setMonth} selected={day} onSelect={(d) => { setDay(d); setPick(null) }}
              isDisabled={(k) => !byDate[k]}
              badge={(k, sel) => {
                const l = byDate[k]; if (!l) return null
                const n = l.filter((s) => s.state === 'available').length
                const cls = sel ? 'text-ink' : n ? 'text-rose' : 'text-cream/40'
                return <span className={cls}>{n ? `${n} open` : l.some((s) => s.state === 'taken') ? 'full' : '—'}</span>
              }}
            />
            {slots.length === 0 && <p className="pt-3 text-center text-sm text-cream/60">No dates are open right now. Please check back soon.</p>}
          </Card>
          {day && byDate[day] && (
            <Card className="space-y-2">
              <h2 className="font-semibold text-peach">{fmtDate(day)}</h2>
              {byDate[day].map((s) => {
                const chosen = pick?.date === day && pick?.time === s.slot_time
                const free = s.state === 'available'
                return (
                  <button key={s.slot_time} disabled={!free} onClick={() => setPick({ date: day, time: s.slot_time })}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left
                      ${chosen ? 'border-rose bg-rose text-ink' : free ? 'border-cream/25 hover:bg-cream/10' : 'border-cream/10 text-cream/35'}`}>
                    <span className={`font-semibold ${s.state === 'taken' ? 'line-through' : ''}`}>{fmtTime(s.slot_time)}</span>
                    <span className="text-xs">{chosen ? 'Selected' : free ? 'Open' : s.state === 'taken' ? 'Booked' : 'Not available for your service'}</span>
                  </button>
                )
              })}
            </Card>
          )}
          <p className="text-xs text-cream/60">Available times depend on the service, length, removal and tier you chose. Slots are first come, first served.</p>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Btn variant="ghost" onClick={load}>Refresh</Btn>
            <Btn disabled={!pick} onClick={onNext}>Review booking</Btn>
          </div>
        </>
      )}
    </div>
  )
}

function Review({ form, pick, onBack, onTaken }) {
  const nav = useNavigate()
  const e = effective(form)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const price = calcPrice(form.service, e.length, form.removal, e.intensive)

  async function submit() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('create_booking', {
      p_name: form.full_name.trim(), p_ig: cleanIg(form.instagram), p_phone: cleanPhone(form.phone), p_age: Number(form.age),
      p_service: form.service, p_length: e.length, p_removal: form.removal, p_tier: Number(form.tier), p_intensive: e.intensive,
      p_date: pick.date, p_time: pick.time,
    })
    setBusy(false)
    if (error) {
      const m = error.message || ''
      if (m.includes('SLOT_TAKEN') || m.includes('SLOT_UNAVAILABLE')) { setErr('Sorry, that slot was just taken. Please pick another one.'); return setTimeout(onTaken, 1800) }
      return setErr('Something went wrong. Please check your details and try again.')
    }
    localStorage.setItem('cpn_booking', JSON.stringify({ code: data, phone: cleanPhone(form.phone) }))
    nav('/my-booking')
  }

  const rows = [
    ['Name', form.full_name], ['Instagram', cleanIg(form.instagram)], ['Phone', form.phone], ['Age', form.age],
    ['Service', SERVICES[form.service].label + (e.length ? ` (${e.length})` : '')],
    ['Removal', REMOVALS[form.removal].label], ['Design tier', `Tier ${form.tier}`],
    ...(e.intensive ? [['Add-on', 'Intensive Manicure']] : []),
  ]
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-cream/60 underline">← Back</button>
      <h1 className="font-display text-3xl font-bold">Review & reserve</h1>
      <Card className="space-y-1 text-sm">
        <div className="mb-2 rounded-xl bg-rose/15 p-3 text-center">
          <div className="font-display text-2xl font-bold text-rose">{fmtDate(pick.date)} · {fmtTime(pick.time)}</div>
        </div>
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
        <div className="flex justify-between border-t border-cream/10 pt-2 font-semibold"><span>Estimated base total</span><span className="text-rose">{peso(price)}</span></div>
      </Card>
      <Card className="space-y-2 text-[13px]">
        <p>⏳ Your slot is held for <b>12 hours</b>. Send a downpayment (min ₱400) via GCash and upload your receipt on the next page within that time, or the slot is released. You can pay right away or later.</p>
        <p>💬 Next, please message <a className="font-semibold text-rose underline" href={IG_URL} target="_blank" rel="noreferrer">{IG_HANDLE}</a> with your design inspo for your full quotation.</p>
      </Card>
      <ErrorText>{err}</ErrorText>
      <Btn className="w-full" disabled={busy} onClick={submit}>{busy ? 'Reserving…' : 'Reserve this slot'}</Btn>
    </div>
  )
}

export default function Book() {
  const [step, setStep] = useState('policy')
  const [form, setForm] = useState(EMPTY)
  const [pick, setPick] = useState(null)
  useEffect(() => window.scrollTo(0, 0), [step])
  return (
    <Shell>
      {step === 'policy' && <PolicyGate onAgree={() => setStep('info')} />}
      {step === 'info' && <ServiceInfo onNext={() => setStep('form')} />}
      {step === 'form' && <DetailsForm form={form} setForm={setForm} onBack={() => setStep('info')} onNext={() => { setPick(null); setStep('slot') }} />}
      {step === 'slot' && <SlotStep form={form} pick={pick} setPick={setPick} onBack={() => setStep('form')} onNext={() => setStep('review')} />}
      {step === 'review' && <Review form={form} pick={pick} onBack={() => setStep('slot')} onTaken={() => { setPick(null); setStep('slot') }} />}
    </Shell>
  )
}
