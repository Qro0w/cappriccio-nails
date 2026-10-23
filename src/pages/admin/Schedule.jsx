import { useCallback, useEffect, useState } from 'react'
import { eachWeekOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { ACTIVE, RULESET_LABEL } from '../../lib/config'
import { fmtDate, fmtDateLong, fmtTime, ymd } from '../../lib/format'
import { Btn, Card, ConfirmDialog, ErrorText, Field, Switch, inputCls } from '../../components/ui'
import Calendar from '../../components/Calendar'
import SlotsOverview from '../../components/SlotsOverview'
import { useRemembered } from '../../lib/remember'

const hhmm = (t) => t.slice(0, 5)
const label = (t) => fmtTime(t.length === 5 ? t + ':00' : t)
const timesText = (list) => [...list].sort().map(label).join(' · ')

// ---------------- preset editor (create / edit one preset) ----------------
function PresetEditor({ preset, onSaved, onClose }) {
  const [name, setName] = useState(preset?.name || '')
  const [times, setTimes] = useState(() => new Set(preset?.times || []))
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const list = [...times].sort()
  const add = () => {
    if (!custom) return
    if (times.has(custom)) { setErr(`${label(custom)} is already in this preset.`); return }
    setTimes((st) => new Set(st).add(custom)); setCustom(''); setErr('')
  }
  const remove = (t) => { setErr(''); setTimes((st) => { const n = new Set(st); n.delete(t); return n }) }

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
      <div className="space-y-2">
        <span className="text-sm font-semibold text-peach">Times</span>
        {list.length === 0 ? (
          <p className="text-xs text-cream/60">No times yet. Add the times for this preset below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((t) => (
              <span key={t} className="anim-in flex min-h-10 items-center gap-1 rounded-full border border-cream/30 bg-cream/[0.06] pl-3.5 pr-1 text-sm font-semibold">
                {label(t)}
                <button type="button" aria-label={`Remove ${label(t)}`} onClick={() => remove(t)}
                  className="flex size-8 items-center justify-center rounded-full text-cream/60 hover:bg-red-500/20 hover:text-red-200">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input type="time" value={custom} onChange={(e) => { setCustom(e.target.value); setErr('') }} className={inputCls + ' flex-1'} aria-label="Time to add" />
        <Btn variant="ghost" disabled={!custom} onClick={add}>Add time</Btn>
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
  const [month, setMonth] = useRemembered('sc.month', () => {
    const now = startOfMonth(new Date())
    return now < new Date(2026, 10, 1) ? new Date(2026, 10, 1) : now // open on November while it's still October
  })
  const [mode, setMode] = useRemembered('sc.mode', 'day') // 'day' = edit one date, 'multi' = pick many dates
  const [day, setDay] = useRemembered('sc.day', null)
  const [picked, setPicked] = useState(() => new Set())
  const [custom, setCustom] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [delTime, setDelTime] = useState(null)
  const [editing, setEditing] = useState(null) // preset object, {} for new, null = closed
  const [delPreset, setDelPreset] = useState(null)
  const [overview, setOverview] = useState(false)
  const [offAsk, setOffAsk] = useState(null) // list of dates to turn into days off
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
  // off = no times · hidden = has times but clients can't see it · full = every time booked · open
  function dayState(k) {
    const open = openOn(k)
    if (!open.length) return 'off'
    if (hiddenReason(k)) return 'hidden'
    const bk = bookedOn(k)
    if (open.every((t) => bk.includes(t))) return 'full'
    return 'open'
  }
  function hiddenReason(k) {
    const m = months.find((x) => x.month === ymd(startOfMonth(parseISO(k))))
    if (!m || !m.visible) return 'month'
    if (days.find((d) => d.day === k)?.visible === false) return 'day'
    return null
  }

  async function setMonthVisible(on) {
    done(await supabase.from('schedule_months').upsert({ month: monthKey, visible: on, ruleset: mrow?.ruleset || 'sheet' }))
  }
  async function setDayFlag(k, patch) {
    const row = days.find((d) => d.day === k)
    done(await supabase.from('schedule_days').upsert({ day: k, visible: row?.visible ?? true, allow_any: row?.allow_any ?? false, ...patch }))
  }
  // Show / hide many dates at once (keeps each day's "any service" setting)
  async function setDaysVisible(dates, visible) {
    setErr(''); setMsg('')
    const flag = (k, v) => ({ day: k, visible: v, allow_any: days.find((d) => d.day === k)?.allow_any ?? false })
    const rows = dates.map((k) => flag(k, visible))
    let opened = 0
    if (visible) {
      // Showing dates in a month that's hidden: open the month, but keep its other dates hidden
      const hiddenMonths = [...new Set(dates.map((k) => k.slice(0, 7) + '-01'))].filter((mk) => !months.find((m) => m.month === mk)?.visible)
      for (const mk of hiddenMonths) {
        const start = parseISO(mk)
        for (let d = start; isSameMonth(d, start); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
          const k = ymd(d)
          if (!dates.includes(k)) rows.push(flag(k, false))
        }
        const r = await supabase.from('schedule_months').upsert({ month: mk, visible: true, ruleset: months.find((m) => m.month === mk)?.ruleset || 'sheet' })
        if (r.error) return done(r)
        opened++
      }
    }
    done(await supabase.from('schedule_days').upsert(rows),
      `${dates.length} date${dates.length === 1 ? '' : 's'} ${visible ? 'shown to' : 'hidden from'} clients ✓${opened ? ' The rest of that month stays hidden.' : ''}`)
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
  // Old "closed" times (from the on/off switch that was removed). Not bookable; safe to tidy away.
  const closedOld = slots.filter((x) => x.is_open === false && !booked.some((b) => b.slot_date === x.slot_date && hhmm(b.slot_time) === hhmm(x.slot_time)))
  async function removeClosed() {
    setErr(''); setMsg('')
    const byDate = {}
    closedOld.forEach((x) => (byDate[x.slot_date] ||= []).push(x.slot_time))
    for (const [d, ts] of Object.entries(byDate)) {
      const r = await supabase.from('schedule_slots').delete().eq('slot_date', d).eq('is_open', false).in('slot_time', ts)
      if (r.error) return done(r)
    }
    done(null, `${closedOld.length} closed time${closedOld.length === 1 ? '' : 's'} removed ✓`)
  }

  // Day off = remove every time on the date(s). Booked times are kept (bookings are never deleted).
  async function makeDaysOff(dates) {
    setOffAsk(null); setErr(''); setMsg('')
    let removed = 0, kept = 0
    for (const d of dates) {
      const bk = bookedOn(d)
      const drop = slotsOn(d).filter((t) => !bk.includes(t))
      kept += slotsOn(d).length - drop.length
      if (!drop.length) continue
      const r = await supabase.from('schedule_slots').delete().eq('slot_date', d).in('slot_time', drop)
      if (r.error) return done(r)
      removed += drop.length
    }
    done(null, `${dates.length === 1 ? 'Day' : `${dates.length} days`} turned off ✓ (${removed} time${removed === 1 ? '' : 's'} removed)${kept ? `. ${kept} booked time${kept === 1 ? ' was' : 's were'} kept. Move or cancel ${kept === 1 ? 'that booking' : 'those bookings'} to fully clear the day.` : ''}`)
  }
  const offCount = (dates) => dates.reduce((n, d) => n + slotsOn(d).filter((t) => !bookedOn(d).includes(t)).length, 0)

  async function removePreset() {
    const p = delPreset; setDelPreset(null)
    done(await supabase.from('slot_presets').delete().eq('id', p.id))
  }

  function tap(k) {
    if (mode === 'day') { setDay(k); setMsg(''); setErr(''); return }
    setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  const seg = (on) => `min-h-11 flex-1 rounded-xl text-sm font-semibold ${on ? 'bg-cream text-ink' : 'text-cream/70'}`
  const pickedList = [...picked].sort()
  // Weeks of the month shown (Sun–Sat), only the dates inside this month
  const weeks = eachWeekOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map((w) => {
    const ds = []
    for (let d = new Date(w); d <= endOfWeek(w); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (isSameMonth(d, month)) ds.push(ymd(d))
    return ds
  })
  const weekLabel = (ds) => ds.length === 1 ? format(parseISO(ds[0]), 'MMM d') : `${format(parseISO(ds[0]), 'MMM d')}–${format(parseISO(ds[ds.length - 1]), 'd')}`
  const weekPicked = (ds) => ds.every((k) => picked.has(k))
  const toggleWeek = (ds) => setPicked((st) => { const n = new Set(st); const all = ds.every((k) => n.has(k)); ds.forEach((k) => (all ? n.delete(k) : n.add(k))); return n })
  const pickedWork = pickedList.filter((k) => slotsOn(k).length > 0) // show/hide only matters for work days
  const pickedHidden = pickedWork.filter((k) => hiddenReason(k)).length
  const drow = day && days.find((d) => d.day === day)
  const todays = day ? slotsOn(day) : []
  const dayList = day ? daySlots(day).sort((x, y) => (x.t < y.t ? -1 : 1)) : []
  const reason = day && hiddenReason(day)
  const reasonText = { month: 'The whole month is hidden from clients.', day: 'You turned this day off for clients.' }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Schedule</h1>
        <button type="button" onClick={() => setOverview(true)} aria-label="Slots overview (download for story)" title="Slots overview"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rose/70 bg-ink/40 text-cream transition hover:bg-rose/10 active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M12 13.5h2M8 16.8h2" />
          </svg>
        </button>
      </div>
      <SlotsOverview open={overview} onClose={() => setOverview(false)} startMonth={startOfMonth(month)} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl font-semibold">{format(month, 'MMMM yyyy')}</div>
            <div className={`text-xs font-semibold ${mvisible ? 'text-peach' : 'text-cream/60'}`}>{mvisible ? 'Visible to clients' : 'Hidden from clients'}</div>
          </div>
          <Switch checked={mvisible} onChange={setMonthVisible} label="Show this month to clients" />
        </div>
        {mrow && (
          <p className="text-xs text-cream/60">
            {RULESET_LABEL[mrow.ruleset]}
          </p>
        )}
        <p className="text-xs text-cream/50">Opening a couple of weeks at a time? Use <b>Many days</b> → pick the weeks → <b>Show</b>. That opens just those weeks, even if the month is hidden.</p>
      </Card>

      {closedOld.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-cream/15 bg-ink/40 p-3 text-sm">
          <p><b>{closedOld.length} “closed” time{closedOld.length === 1 ? '' : 's'}</b> left over from the old on/off switch. Clients already can’t book {closedOld.length === 1 ? 'it' : 'them'}, so removing {closedOld.length === 1 ? 'it' : 'them'} changes nothing for clients. It just tidies your schedule.</p>
          <Btn variant="ghost" className="w-full !min-h-11 text-sm" onClick={removeClosed}>Remove closed times</Btn>
        </div>
      )}

      <div className="flex gap-1 rounded-2xl bg-cream/5 p-1">
        <button className={seg(mode === 'day')} onClick={() => setMode('day')}>Edit one day</button>
        <button className={seg(mode === 'multi')} onClick={() => { setMode('multi'); setMsg('') }}>Many days</button>
      </div>

      <Card>
        <Calendar month={month} onMonth={setMonth} selected={day} onSelect={tap}
          isSelected={mode === 'multi' ? (k) => picked.has(k) : undefined}
          dayClass={(k) => {
            const st = dayState(k)
            if (st === 'off') return 'bg-transparent text-cream/35 hover:bg-cream/5'
            if (st === 'hidden') return 'border border-dashed border-cream/35 bg-transparent text-cream/55 hover:bg-cream/5'
            if (st === 'full') return 'border border-cream/25 bg-cream/10 hover:bg-cream/15'
            return 'border border-rose/45 bg-rose/15 hover:bg-rose/25'
          }}
          badge={(k, sel) => {
            if (mode === 'multi' && picked.has(k)) return <span className="text-ink">✓</span>
            const st = dayState(k)
            const n = openOn(k).length
            if (st === 'off') return <span className={sel ? 'text-ink' : ''}>off</span>
            if (st === 'full') return <span className={sel ? 'text-ink' : 'font-semibold text-cream/70'}>full</span>
            return <span className={sel ? 'text-ink' : st === 'hidden' ? '' : 'font-bold text-rose'}>{n}</span>
          }} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-3 text-xs text-cream/65">
          <span className="flex items-center gap-1.5"><span className="inline-block size-3.5 shrink-0 rounded border border-rose/45 bg-rose/15" />Work day, open</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3.5 shrink-0 rounded border border-dashed border-cream/40" />Work day, hidden</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3.5 shrink-0 rounded border border-cream/25 bg-cream/10" />Fully booked</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3.5 shrink-0 rounded text-center text-[9px] leading-[14px] text-cream/40">off</span>Day off (no times)</span>
          <span className="col-span-2 text-cream/45">The number = how many times are on that day.</span>
        </div>
      </Card>

      <ErrorText>{err}</ErrorText>
      {msg && <p className="rounded-2xl bg-cream/10 p-3 text-center text-sm font-semibold text-cream">{msg}</p>}

      {mode === 'multi' && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">{picked.size ? `${picked.size} date${picked.size === 1 ? '' : 's'} picked` : 'Tap dates to pick them'}</h2>
            {picked.size > 0 && <button className="min-h-11 text-sm font-semibold text-peach underline" onClick={() => setPicked(new Set())}>Clear</button>}
          </div>
          <div className="space-y-1.5">
            <div className="text-sm font-semibold text-peach">Pick whole weeks</div>
            <div className="flex flex-wrap gap-2">
              {weeks.map((ds) => (
                <button key={ds[0]} type="button" onClick={() => toggleWeek(ds)}
                  className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition-colors ${weekPicked(ds) ? 'border-cream bg-cream text-ink' : 'border-cream/20 bg-ink/40 text-cream/80'}`}>
                  {weekPicked(ds) && '✓ '}{weekLabel(ds)}
                </button>
              ))}
            </div>
          </div>
          {picked.size > 0 && <p className="text-xs text-cream/60">{pickedList.map(fmtDate).join(', ')}</p>}
          {pickedWork.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-cream/10 bg-ink/40 p-3">
              <div className="font-semibold">Show or hide for clients</div>
              <div className="text-xs text-cream/70">
                Applies to the {pickedWork.length} work day{pickedWork.length === 1 ? '' : 's'} you picked{pickedWork.length < picked.size ? ` (${picked.size - pickedWork.length} day${picked.size - pickedWork.length === 1 ? '' : 's'} off skipped)` : ''}. {pickedHidden ? `${pickedHidden} ${pickedHidden === 1 ? 'is' : 'are'} hidden right now.` : 'All of them are showing right now.'} Hiding keeps the times and any existing bookings; clients just can’t book those dates.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" className="!min-h-11 text-sm" onClick={() => setDaysVisible(pickedWork, false)}>🙈 Hide</Btn>
                <Btn className="!min-h-11 text-sm" onClick={() => setDaysVisible(pickedWork, true)}>Show</Btn>
              </div>
            </div>
          )}
          {offCount(pickedList) > 0 && (
            <div className="space-y-2 rounded-2xl border border-cream/10 bg-ink/40 p-3">
              <div className="font-semibold">Make days off</div>
              <div className="text-xs text-cream/70">Removes all the times on the picked dates, so they become days off. Booked times are kept.</div>
              <Btn variant="ghost" className="w-full !min-h-11 text-sm" onClick={() => setOffAsk(pickedWork)}>
                Turn {pickedWork.length} work day{pickedWork.length === 1 ? '' : 's'} into days off
              </Btn>
            </div>
          )}
          {picked.size > 0 && <div className="pt-1 text-sm font-semibold text-peach">Fill with a preset</div>}
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
          <div>
            <h2 className="font-display text-xl font-semibold">{fmtDateLong(day)}</h2>
            <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${!todays.length ? 'bg-cream/10 text-cream/60' : reason ? 'border border-dashed border-cream/35 text-cream/60' : 'bg-rose/15 text-rose'}`}>
              {!todays.length ? 'Day off' : reason ? 'Hidden from clients' : 'Showing to clients'}
            </div>
          </div>
          {reason === 'month' && todays.length > 0 && <p className="rounded-xl bg-peach/10 p-2 text-xs font-semibold text-peach">{reasonText[reason]}</p>}

          <div>
            <div className="mb-2 text-sm font-semibold text-peach">Time slots</div>
            {dayList.length === 0 && <p className="text-sm text-cream/60">This is a day off. Add a time or fill it from a preset to make it a work day.</p>}
            <div className="space-y-2">
              {dayList.map(({ t, open }) => {
                const lock = bookedOn(day).includes(t)
                return (
                  <div key={t} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${open && !reason ? 'border-rose/50 bg-rose/10' : open ? 'border-dashed border-cream/25 bg-ink/30' : 'border-cream/10 bg-ink/40'}`}>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${open ? '' : 'text-cream/50 line-through'}`}>{label(t)}{lock && ' 🔒'}</div>
                      <div className="text-xs text-cream/60">{lock ? 'Booked' : !open ? 'Closed · clients can’t book it' : reason ? 'Ready · shows once the day is shown' : 'Open'}</div>
                    </div>
                    {!open && <button className="min-h-11 px-2 text-sm font-semibold text-peach underline" onClick={() => setTimeOpen(t, true)}>Reopen</button>}
                    <button aria-label={`Remove ${label(t)}`} disabled={lock} onClick={() => setDelTime(t)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-cream/70 hover:bg-cream/10 disabled:opacity-25">✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-peach">Add a time</div>
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

          {todays.length > 0 && <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 p-3">
              <div className="text-sm">Any service, any time<div className="text-xs text-cream/60">Ignores the service rules for this day</div></div>
              <Switch checked={drow?.allow_any ?? false} onChange={(v) => setDayFlag(day, { allow_any: v })} label="Any service, any time" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 p-3">
              <div className="text-sm">Show this day to clients
                <div className="text-xs text-cream/50">Hide every work day in a week and clients see “Available soon” across that week.</div>
              </div>
              <Switch checked={drow?.visible ?? true} onChange={(v) => setDayFlag(day, { visible: v })} label="Show this day" />
            </div>
          </div>}

          {offCount([day]) > 0 && <Btn variant="ghost" className="w-full" onClick={() => setOffAsk([day])}>Make this a day off</Btn>}

          {todays.length > 0 && <p className="text-xs text-cream/50">✕ = remove the time from this day. 🔒 = booked (can’t be removed). To stop clients booking a whole day without losing its times, switch off “Show this day to clients”. Changes show to clients right away and never delete bookings.</p>}
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">My presets</h2>
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

      <ConfirmDialog open={!!delTime} danger title={`Remove ${delTime ? label(delTime) : ''}?`} body="This time is removed from this day completely. You can add it back any time." confirmLabel="Remove" onConfirm={removeTime} onCancel={() => setDelTime(null)} />
      <ConfirmDialog open={!!offAsk} danger title={offAsk?.length === 1 ? 'Make this a day off?' : `Make ${offAsk?.length} days off?`}
        body={offAsk ? `${offCount(offAsk)} time${offCount(offAsk) === 1 ? '' : 's'} will be removed${offAsk.length === 1 ? ` from ${fmtDate(offAsk[0])}` : ''}. Booked times stay. You can add times back any time.` : ''}
        confirmLabel="Yes, make day off" onConfirm={() => makeDaysOff(offAsk)} onCancel={() => setOffAsk(null)} />
      <ConfirmDialog open={!!delPreset} danger title="Delete this preset?" body={`“${delPreset?.name}” will be removed. Dates already filled with it stay as they are.`} confirmLabel="Delete" onConfirm={removePreset} onCancel={() => setDelPreset(null)} />
      <ConfirmDialog open={!!replaceAsk} title={`Replace with “${replaceAsk?.name}”?`}
        body={`The ${picked.size} picked date(s) will have only these times: ${replaceAsk ? timesText(replaceAsk.times) : ''}. Other open times on those dates are removed, except booked ones.`}
        confirmLabel="Apply" onConfirm={() => { const p = replaceAsk; setReplaceAsk(null); applyPreset(p, pickedList, true) }} onCancel={() => setReplaceAsk(null)} />
    </div>
  )
}
