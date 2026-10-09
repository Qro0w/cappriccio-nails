import { useCallback, useEffect, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, ALL_TIMES, RULESET_LABEL } from '../../lib/config'
import { fmtDate, fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, Switch, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'

const hhmm = (t) => t.slice(0, 5)
const label = (t) => fmtTime(t.length === 5 ? t + ':00' : t)
const timesText = (list) => [...list].sort().map(label).join(' · ')

// ---------------- preset editor (create / edit one preset) ----------------
function PresetEditor({ preset, onSaved, onClose }) {
  const [name, setName] = useState(preset?.name || '')
  const [times, setTimes] = useState(() => new Set(preset?.times || []))
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const all = [...new Set([...ALL_TIMES, ...times])].sort()
  const flip = (t) => setTimes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })

  async function save() {
    setErr('')
    const row = { name: name.trim(), times: [...times].sort() }
    const r = preset?.id
      ? await supabase.from('slot_presets').update(row).eq('id', preset.id)
      : await supabase.from('slot_presets').insert({ ...row, position: Date.now() % 1e6 })
    if (r.error) return setErr('Could not save the preset.')
    onSaved()
  }
  return (
    <div className="space-y-3 rounded-2xl border-2 border-cream/15 bg-ink/40 p-3">
      <Field label="Preset name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekday 4 slots" maxLength={40} /></Field>
      <div className="grid grid-cols-3 gap-2">
        {all.map((t) => (
          <button key={t} type="button" onClick={() => flip(t)}
            className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${times.has(t) ? 'border-rose bg-rose text-ink' : 'border-cream/15 bg-ink text-cream/60'}`}>{label(t)}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} className={inputCls + ' flex-1'} />
        <Btn variant="ghost" disabled={!custom} onClick={() => { flip(custom); setCustom('') }}>Add</Btn>
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!name.trim() || times.size === 0} onClick={save}>Save preset</Btn>
      </div>
    </div>
  )
}

export default function Schedule() {
  const [slots, setSlots] = useState([])
  const [booked, setBooked] = useState([])
  const [months, setMonths] = useState([])
  const [days, setDays] = useState([])
  const [presets, setPresets] = useState([])
  const [month, setMonth] = useState(() => {
    const now = startOfMonth(new Date())
    return now < new Date(2026, 10, 1) ? new Date(2026, 10, 1) : now // open on November while it's still October
  })
  const [mode, setMode] = useState('day') // 'day' = edit one date, 'multi' = pick many dates
  const [day, setDay] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [closing, setClosing] = useState(false)
  const [delTime, setDelTime] = useState(null)
  const [editing, setEditing] = useState(null) // preset object, {} for new, null = closed
  const [delPreset, setDelPreset] = useState(null)
  const [replaceAsk, setReplaceAsk] = useState(null) // preset to apply in "replace" mode

  const load = useCallback(async () => {
    const [s, b, m, d, p] = await Promise.all([
      supabase.from('schedule_slots').select('slot_date,slot_time,is_open').order('slot_date').order('slot_time'),
      supabase.from('bookings').select('slot_date,slot_time').in('status', ACTIVE),
      supabase.from('schedule_months').select('*'),
      supabase.from('schedule_days').select('*'),
      supabase.from('slot_presets').select('*').order('position').order('created_at'),
    ])
    const missing = [m, d, p].find((r) => r.error)
    if (missing) setErr('Some schedule tables are missing. Run 06_upgrade_v4.sql and 07_presets.sql in Supabase (see the update steps).')
    setSlots(s.data || []); setBooked(b.data || []); setMonths(m.data || []); setDays(d.data || []); setPresets(p.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const done = (r, ok = '') => {
    if (r?.error) { setErr('Could not save that change. Please try again.'); setMsg('') }
    else { setErr(''); setMsg(ok) }
    load()
  }

  const monthKey = ymd(startOfMonth(month))
  const mrow = months.find((m) => m.month === monthKey)
  const mvisible = !!mrow?.visible
  const daySlots = (k) => slots.filter((s) => s.slot_date === k).map((s) => ({ t: hhmm(s.slot_time), open: s.is_open !== false }))
  const slotsOn = (k) => daySlots(k).map((x) => x.t)
  const openOn = (k) => daySlots(k).filter((x) => x.open).map((x) => x.t)
  const bookedOn = (k) => booked.filter((b) => b.slot_date === k).map((b) => hhmm(b.slot_time))

  // mirrors slot_visible() in the database
  function hiddenReason(k) {
    const m = months.find((x) => x.month === ymd(startOfMonth(parseISO(k))))
    if (!m || !m.visible) return 'month'
    if (days.find((d) => d.day === k)?.visible === false) return 'day'
    return null
  }

  async function setMonthVisible(on) {
    done(await supabase.from('schedule_months').upsert({ month: monthKey, visible: on, ruleset: mrow?.ruleset || 'sheet', window_days: mrow?.window_days ?? null }))
  }
  async function setDayFlag(k, patch) {
    const row = days.find((d) => d.day === k)
    done(await supabase.from('schedule_days').upsert({ day: k, visible: row?.visible ?? true, allow_any: row?.allow_any ?? false, ...patch }))
  }
  async function addTime(t) {
    if (!t) return
    if (slotsOn(day).includes(t)) return setErr('That time is already on this day.')
    done(await supabase.from('schedule_slots').insert({ slot_date: day, slot_time: t, is_open: true }))
  }
  async function setTimeOpen(t, open) {
    if (!open && bookedOn(day).includes(t)) return setErr('This slot has an active booking. Move or reject that booking first.')
    done(await supabase.from('schedule_slots').update({ is_open: open }).eq('slot_date', day).eq('slot_time', t))
  }
  async function removeTime() {
    const t = delTime; setDelTime(null)
    if (bookedOn(day).includes(t)) return setErr('This slot has an active booking. Move or reject that booking first.')
    done(await supabase.from('schedule_slots').delete().eq('slot_date', day).eq('slot_time', t), `${label(t)} removed from this day ✓`)
  }

  // Apply a preset to dates. replace = also remove times not in the preset (booked times are always kept).
  async function applyPreset(preset, dates, replace) {
    setErr(''); setMsg('')
    const rows = dates.flatMap((d) => preset.times.map((t) => ({ slot_date: d, slot_time: t, is_open: true })))
    const add = await supabase.from('schedule_slots').upsert(rows, { onConflict: 'slot_date,slot_time' })
    if (add.error) return done(add)
    let kept = 0
    if (replace) {
      for (const d of dates) {
        const extra = slotsOn(d).filter((t) => !preset.times.includes(t))
        const lockd = extra.filter((t) => bookedOn(d).includes(t))
        kept += lockd.length
        const drop = extra.filter((t) => !lockd.includes(t))
        if (drop.length) {
          const r = await supabase.from('schedule_slots').delete().eq('slot_date', d).in('slot_time', drop)
          if (r.error) return done(r)
        }
      }
    }
    done(null, `“${preset.name}” applied to ${dates.length} date${dates.length === 1 ? '' : 's'} ✓${kept ? ` (${kept} booked time${kept === 1 ? '' : 's'} kept)` : ''}`)
  }
  async function closeDay() {
    setClosing(false)
    if (bookedOn(day).length) return setErr('This day has active bookings. Move or reject them first.')
    done(await supabase.from('schedule_slots').delete().eq('slot_date', day))
  }
  async function removePreset() {
    const p = delPreset; setDelPreset(null)
    done(await supabase.from('slot_presets').delete().eq('id', p.id))
  }

  function tap(k) {
    if (mode === 'day') { setDay(k); setMsg(''); setErr(''); return }
    setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  const seg = (on) => `min-h-11 flex-1 rounded-xl text-sm font-semibold ${on ? 'bg-rose text-ink' : 'text-cream/70'}`
  const pickedList = [...picked].sort()
  const drow = day && days.find((d) => d.day === day)
  const todays = day ? slotsOn(day) : []
  const dayList = day ? daySlots(day).sort((x, y) => (x.t < y.t ? -1 : 1)) : []
  const suggestions = ALL_TIMES.filter((t) => !todays.includes(t))
  const reason = day && hiddenReason(day)
  const reasonText = { month: 'The whole month is hidden from clients.', day: 'You turned this day off for clients.' }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold text-rose">Schedule</h1>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl font-bold">{format(month, 'MMMM yyyy')}</div>
            <div className={`text-xs font-semibold ${mvisible ? 'text-peach' : 'text-cream/60'}`}>{mvisible ? 'Visible to clients' : 'Hidden from clients'}</div>
          </div>
          <Switch checked={mvisible} onChange={setMonthVisible} label="Show this month to clients" />
        </div>
        {mrow && (
          <p className="text-xs text-cream/60">
            {RULESET_LABEL[mrow.ruleset]}
          </p>
        )}
      </Card>

      <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
        <button className={seg(mode === 'day')} onClick={() => setMode('day')}>Edit one day</button>
        <button className={seg(mode === 'multi')} onClick={() => { setMode('multi'); setMsg('') }}>Fill many days</button>
      </div>

      <Card>
        <Calendar month={month} onMonth={setMonth} selected={day} onSelect={tap}
          isSelected={mode === 'multi' ? (k) => picked.has(k) : undefined}
          badge={(k, sel) => {
            if (mode === 'multi' && picked.has(k)) return <span className="text-ink">✓</span>
            const n = openOn(k).length
            if (!n) return <span className={sel ? 'text-ink' : 'text-cream/30'}>off</span>
            const hid = hiddenReason(k)
            return <span className={sel ? 'text-ink' : hid ? 'text-cream/40' : 'font-bold text-rose'}>{hid ? '🙈' : n}</span>
          }} />
        <p className="pt-3 text-xs text-cream/50">Number = open times · 🙈 = hidden from clients · off = no open times</p>
      </Card>

      <ErrorText>{err}</ErrorText>
      {msg && <p className="rounded-2xl bg-emerald-400/10 p-3 text-center text-sm font-semibold text-emerald-200">{msg}</p>}

      {mode === 'multi' && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">{picked.size ? `${picked.size} date${picked.size === 1 ? '' : 's'} picked` : 'Tap dates to pick them'}</h2>
            {picked.size > 0 && <button className="min-h-11 text-sm font-semibold text-peach underline" onClick={() => setPicked(new Set())}>Clear</button>}
          </div>
          {picked.size > 0 && <p className="text-xs text-cream/60">{pickedList.map(fmtDate).join(', ')}</p>}
          {presets.length === 0 && <p className="text-sm text-cream/60">No presets yet. Make one below.</p>}
          {presets.map((p) => (
            <div key={p.id} className="space-y-2 rounded-2xl border border-cream/10 bg-ink/40 p-3">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-cream/70">{timesText(p.times)}</div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" className="!min-h-11 text-sm" disabled={!picked.size} onClick={() => applyPreset(p, pickedList, false)}>Add times</Btn>
                <Btn className="!min-h-11 text-sm" disabled={!picked.size} onClick={() => setReplaceAsk(p)}>Replace</Btn>
              </div>
            </div>
          ))}
          <p className="text-xs text-cream/50">“Add times” keeps the times already open. “Replace” makes the picked dates match the preset (booked times are always kept).</p>
        </Card>
      )}

      {mode === 'day' && !day && <p className="text-center text-sm text-cream/60">Tap a date to edit it.</p>}

      {mode === 'day' && day && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl font-bold">{fmtDateLong(day)}</h2>
          {reason && todays.length > 0 && <p className="rounded-xl bg-peach/10 p-2 text-xs font-semibold text-peach">{reasonText[reason]}</p>}

          <div>
            <div className="mb-2 text-sm font-semibold text-peach">Time slots</div>
            {dayList.length === 0 && <p className="text-sm text-cream/60">No times on this day yet. Add one below.</p>}
            <div className="space-y-2">
              {dayList.map(({ t, open }) => {
                const lock = bookedOn(day).includes(t)
                return (
                  <div key={t} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${open ? 'border-rose/50 bg-rose/10' : 'border-cream/10 bg-ink/40'}`}>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${open ? '' : 'text-cream/50 line-through'}`}>{label(t)}{lock && ' 🔒'}</div>
                      <div className="text-xs text-cream/60">{lock ? 'Booked' : open ? 'Open' : 'Closed for now'}</div>
                    </div>
                    <Switch checked={open} disabled={lock} onChange={(v) => setTimeOpen(t, v)} label={`${label(t)} open`} />
                    <button aria-label={`Remove ${label(t)}`} disabled={lock} onClick={() => setDelTime(t)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-cream/70 hover:bg-cream/10 disabled:opacity-25">✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-peach">Add a time</div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((t) => (
                  <button key={t} onClick={() => addTime(t)} className="min-h-10 rounded-full border border-cream/20 bg-ink/40 px-3 text-sm font-semibold text-cream/80">+ {label(t)}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} className={inputCls + ' flex-1'} />
              <Btn variant="ghost" disabled={!custom} onClick={() => { addTime(custom); setCustom('') }}>Add</Btn>
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-peach">Fill from a preset</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button key={p.id} onClick={() => applyPreset(p, [day], true)}
                    className="min-h-11 rounded-full border border-cream/20 bg-ink/40 px-4 text-sm font-semibold text-peach">{p.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 p-3">
              <div className="text-sm">Any service, any time<div className="text-xs text-cream/60">Ignores the service rules for this day</div></div>
              <Switch checked={drow?.allow_any ?? false} onChange={(v) => setDayFlag(day, { allow_any: v })} label="Any service, any time" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 p-3">
              <div className="text-sm">Show this day to clients</div>
              <Switch checked={drow?.visible ?? true} onChange={(v) => setDayFlag(day, { visible: v })} label="Show this day" />
            </div>
          </div>

          {todays.length > 0 && <Btn variant="danger" className="w-full" onClick={() => setClosing(true)}>Remove all times for this day</Btn>}
          <p className="text-xs text-cream/50">Switch off = closed but kept on the day. ✕ = removed from the day. 🔒 = booked (can’t be closed or removed). Changes show to clients right away and never delete bookings.</p>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">My presets</h2>
          {!editing && <Btn variant="ghost" className="!min-h-10 text-sm" onClick={() => setEditing({})}>+ New</Btn>}
        </div>
        {editing && !editing.id && <PresetEditor preset={null} onSaved={() => { setEditing(null); load() }} onClose={() => setEditing(null)} />}
        {presets.map((p) => editing?.id === p.id ? (
          <PresetEditor key={p.id} preset={p} onSaved={() => { setEditing(null); load() }} onClose={() => setEditing(null)} />
        ) : (
          <div key={p.id} className="flex items-center justify-between gap-2 border-t border-cream/10 pt-3">
            <div className="min-w-0">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-cream/60">{timesText(p.times)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="min-h-11 px-3 text-sm font-semibold text-peach" onClick={() => setEditing(p)}>Edit</button>
              <button className="min-h-11 px-3 text-sm font-semibold text-red-300" onClick={() => setDelPreset(p)}>Delete</button>
            </div>
          </div>
        ))}
      </Card>

      <ConfirmDialog open={closing} danger title="Remove all times?" body="All open times on this date will be removed so clients can't book it." confirmLabel="Yes, remove" onConfirm={closeDay} onCancel={() => setClosing(false)} />
      <ConfirmDialog open={!!delTime} danger title={`Remove ${delTime ? label(delTime) : ''}?`} body="This time is removed from this day completely. You can add it back any time." confirmLabel="Remove" onConfirm={removeTime} onCancel={() => setDelTime(null)} />
      <ConfirmDialog open={!!delPreset} danger title="Delete this preset?" body={`“${delPreset?.name}” will be removed. Dates already filled with it stay as they are.`} confirmLabel="Delete" onConfirm={removePreset} onCancel={() => setDelPreset(null)} />
      <ConfirmDialog open={!!replaceAsk} title={`Replace with “${replaceAsk?.name}”?`}
        body={`The ${picked.size} picked date(s) will have only these times: ${replaceAsk ? timesText(replaceAsk.times) : ''}. Other open times on those dates are removed, except booked ones.`}
        confirmLabel="Apply" onConfirm={() => { const p = replaceAsk; setReplaceAsk(null); applyPreset(p, pickedList, true) }} onCancel={() => setReplaceAsk(null)} />
    </div>
  )
}
