import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseISO, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { INTENSIVE_FEE, LENGTHS, REMOVALS, SERVICES, calcPrice, intensiveAllowed, removalOptions } from '../../lib/config'
import { AFTER_RESERVE, F_HARD_NOTE, POLICY_VERSION, REMOVAL_NOTE, SERVICE_GROUPS, TIER_NOTE, policyAccepted, savePolicyAccepted } from '../../lib/content'
import Rich from '../../components/Rich'
import { cleanIg, cleanPhone, fmtDate, fmtTime, peso, validPhone } from '../../lib/format'
import { BackLink, Btn, Card, ErrorText, Field, Shell, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import PolicyGate from '../../components/PolicyGate'
import ServicePicker, { RatesTable } from '../../components/ServicePicker'
import TierPicker from '../../components/TierPicker'

const INTENSIVE_TEXT = SERVICE_GROUPS.find((g) => g.title === 'Add-on service').items[0].text

const EMPTY = { full_name: '', instagram: '', phone: '', age: '', service: '', length: '', removal: '', tier: '', intensive: false }

// Values that actually get used (length only for extensions, intensive only when allowed)
const effective = (f) => {
  const ext = SERVICES[f.service]?.ext
  const canIntensive = !!(f.service && f.tier && f.removal && intensiveAllowed(f.service, f.tier, f.removal))
  return { ext, length: ext ? f.length : null, canIntensive, intensive: canIntensive && f.intensive }
}

function Build({ form, setForm, onNext, onBack }) {
  const set = (k, v) => setForm({ ...form, [k]: v })
  const [rates, setRates] = useState(false)
  const e = effective(form)
  const price = calcPrice(form.service, e.length, form.removal, e.intensive)
  const opts = form.service ? removalOptions(form.service) : []
  const ready =
    form.full_name.trim() && form.instagram.replace('@', '').trim() && validPhone(form.phone) &&
    Number(form.age) >= 1 && form.service && (!e.ext || form.length) && form.removal && form.tier

  return (
    <div className="space-y-6 pb-4">
      <BackLink onClick={onBack}>Back</BackLink>
      <h1 className="font-display text-3xl font-semibold">Book your appointment</h1>

      <section className="space-y-3">
        <h2 className="font-display text-[1.45rem] italic text-rose">1. Choose your service</h2>
        <ServicePicker selected={form.service} onSelect={(k) => setForm({ ...form, service: k, length: '', removal: '', intensive: false })} />
        <button type="button" onClick={() => setRates(!rates)} className="min-h-11 text-sm font-semibold text-peach underline">
          {rates ? 'Hide rates' : 'View all rates'}
        </button>
        {rates && <RatesTable />}
      </section>

      {form.service && (
        <section className="space-y-3">
          <h2 className="font-display text-[1.45rem] italic text-rose">2. Your set</h2>
          <Card className="space-y-4">
            {e.ext && (
              <Field label="What length">
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button key={l} type="button" onClick={() => set('length', l)}
                      className={`min-h-12 rounded-xl border capitalize ${form.length === l ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{l}</button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="If removal is needed">
              <select className={inputCls} value={form.removal} onChange={(ev) => set('removal', ev.target.value)}>
                <option value="">Choose…</option>
                <option value="none">{REMOVALS.none.label}</option>
                {['My Work', 'Foreign Removals'].map((g) => (
                  <optgroup key={g} label={g}>
                    {opts.filter((k) => REMOVALS[k].group === g).map((k) => (
                      <option key={k} value={k}>{REMOVALS[k].label} (+{peso(REMOVALS[k].fee)})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {form.removal === 'f_hard' && <span className="mt-1 block text-xs font-semibold text-peach">{F_HARD_NOTE}</span>}
              <span className="mt-1 block text-xs text-cream/60"><Rich text={REMOVAL_NOTE} /></span>
            </Field>
          </Card>
        </section>
      )}

      {form.service && (
        <section className="space-y-3">
          <h2 className="font-display text-[1.45rem] italic text-rose">3. Design tier level</h2>
          <TierPicker value={form.tier} onChange={(n) => set('tier', n)} />
          <p className="text-xs text-cream/70">{TIER_NOTE}</p>
          {e.canIntensive && (
            <label className="flex items-start gap-3 rounded-2xl border border-cream/20 p-3">
              <input type="checkbox" className="mt-0.5 size-6 shrink-0 accent-rose" checked={form.intensive} onChange={(ev) => set('intensive', ev.target.checked)} />
              <span className="text-sm">Add Intensive Manicure <span className="text-rose">(+{peso(INTENSIVE_FEE)})</span>
                <span className="mt-1 block text-xs text-cream/60"><Rich text={INTENSIVE_TEXT} /></span></span>
            </label>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[1.45rem] italic text-rose">{form.service ? '4' : '2'}. Your details</h2>
        <Card className="space-y-3">
          <Field label="Name"><input className={inputCls} value={form.full_name} onChange={(ev) => set('full_name', ev.target.value)} autoComplete="name" /></Field>
          <Field label="Instagram handle"><input className={inputCls} value={form.instagram} onChange={(ev) => set('instagram', ev.target.value)} autoCapitalize="none" placeholder="@yourname" /></Field>
          <Field label="Phone number"><input className={inputCls} inputMode="tel" value={form.phone} onChange={(ev) => set('phone', ev.target.value)} autoComplete="tel" placeholder="09XX XXX XXXX" /></Field>
          <Field label="Age"><input className={inputCls} inputMode="numeric" value={form.age} onChange={(ev) => set('age', ev.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
        </Card>
      </section>

      <div className="sticky bottom-3 space-y-2 rounded-2xl border border-cream/10 bg-ink/95 p-3 shadow-lg backdrop-blur">
        {price != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-cream/70">Estimated base total</span>
            <span className="font-display text-2xl font-semibold text-rose">{peso(price)}</span>
          </div>
        )}
        <Btn className="w-full" disabled={!ready} onClick={onNext}>Choose date & time</Btn>
      </div>
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
  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    const f = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', f)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', f) }
  }, []) // eslint-disable-line

  const byDate = useMemo(() => {
    const m = {}
    ;(slots || []).forEach((s) => (m[s.slot_date] ||= []).push(s))
    return m
  }, [slots])

  return (
    <div className="space-y-4">
      <BackLink onClick={onBack}>Back</BackLink>
      <h1 className="font-display text-3xl font-semibold">Pick a date & time</h1>
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
                      ${chosen ? 'border-cream bg-cream text-ink' : free ? 'border-cream/25 hover:bg-cream/10' : 'border-cream/10 text-cream/35'}`}>
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
      p_date: pick.date, p_time: pick.time, p_policy_version: POLICY_VERSION,
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
    ['Name', form.full_name], ['Instagram handle', cleanIg(form.instagram)], ['Phone number', form.phone], ['Age', form.age],
    ['Service', SERVICES[form.service].label + (e.length ? ` (${e.length})` : '')],
    ['Removal', REMOVALS[form.removal].label], ['Design tier level', `Tier ${form.tier}`],
    ...(e.intensive ? [['Add-on', 'Intensive Manicure']] : []),
  ]
  return (
    <div className="space-y-4">
      <BackLink onClick={onBack}>Back</BackLink>
      <h1 className="font-display text-3xl font-semibold">Review & reserve</h1>
      <Card className="space-y-1 text-sm">
        <div className="mb-2 rounded-xl bg-rose/15 p-3 text-center">
          <div className="font-display text-2xl font-semibold text-rose">{fmtDate(pick.date)} · {fmtTime(pick.time)}</div>
        </div>
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-cream/60">{k}</span><span className="text-right">{v}</span></div>)}
        <div className="flex justify-between border-t border-cream/10 pt-2 font-semibold"><span>Estimated base total</span><span className="text-rose">{peso(price)}</span></div>
      </Card>
      <Card className="space-y-2 text-[13px]">
        <p><Rich text="!!NO DOWNPAYMENT = NO APPOINTMENT.!! **Down payment must be paid strictly within 12 hours of booking.**" /> Your 12 hours start the moment you reserve. Upload your receipt on the next page.</p>
        <p>{AFTER_RESERVE}</p>
      </Card>
      <ErrorText>{err}</ErrorText>
      <Btn className="w-full" disabled={busy} onClick={submit}>{busy ? 'Reserving…' : 'Reserve this slot'}</Btn>
    </div>
  )
}

export default function Book() {
  const nav = useNavigate()
  const [step, setStep] = useState(() => (policyAccepted() ? 'build' : 'policy'))
  const [form, setForm] = useState(EMPTY)
  const [pick, setPick] = useState(null)
  useEffect(() => {
    // braces on purpose: an effect must not return a value
    try { window.scrollTo(0, 0) } catch { /* ignore */ }
  }, [step])
  return (
    <Shell>
      {step === 'policy' && <PolicyGate onBack={<BackLink to="/">Back</BackLink>} onAgree={() => { savePolicyAccepted(); setStep('build') }} />}
      {step === 'build' && <Build form={form} setForm={setForm} onBack={() => nav('/')} onNext={() => { setPick(null); setStep('slot') }} />}
      {step === 'slot' && <SlotStep form={form} pick={pick} setPick={setPick} onBack={() => setStep('build')} onNext={() => setStep('review')} />}
      {step === 'review' && <Review form={form} pick={pick} onBack={() => setStep('slot')} onTaken={() => { setPick(null); setStep('slot') }} />}
    </Shell>
  )
}
