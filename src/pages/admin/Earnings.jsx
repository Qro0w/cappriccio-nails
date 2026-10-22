import { useEffect, useMemo, useState } from 'react'
import { addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { peso, ymd } from '../../lib/format'
import { Card } from '../../components/ui'
import { EmptyState, Skeleton } from '../../components/Feedback'
import { useRemembered } from '../../lib/remember'

const total = (b) => (b.final_price != null ? b.final_price : b.estimated_price)
const PAID = ['confirmed', 'completed', 'no_show', 'cancelled']

// Money for one month, counted by appointment date.
function summarize(list) {
  const done = list.filter((b) => b.status === 'completed')
  const dp = list.filter((b) => PAID.includes(b.status) && b.dp_amount != null).reduce((s, b) => s + b.dp_amount, 0)
  const bal = list.filter((b) => b.balance_paid != null).reduce((s, b) => s + b.balance_paid, 0)
  const upcoming = list.filter((b) => b.status === 'confirmed' && b.balance_paid == null)
  const toCollect = upcoming.reduce((s, b) => s + Math.max(0, total(b) - (b.dp_amount || 0)), 0)
  return {
    dp, bal, collected: dp + bal, toCollect,
    sets: done.length, value: done.reduce((s, b) => s + total(b), 0),
    noShow: list.filter((b) => b.status === 'no_show').length,
    cancelled: list.filter((b) => b.status === 'cancelled').length,
    kept: list.filter((b) => ['no_show', 'cancelled'].includes(b.status) && b.dp_amount != null).reduce((s, b) => s + b.dp_amount, 0),
  }
}

export default function Earnings() {
  const [rows, setRows] = useState(null)
  const [month, setMonth] = useRemembered('ea.month', () => startOfMonth(new Date()))
  useEffect(() => {
    supabase.from('bookings').select('status,slot_date,estimated_price,final_price,dp_amount,balance_paid,balance_method').then(({ data }) => setRows(data || []))
  }, [])

  const inMonth = useMemo(() => (rows || []).filter((b) => b.slot_date >= ymd(month) && b.slot_date <= ymd(endOfMonth(month))), [rows, month])
  const s = summarize(inMonth)
  const weeks = useMemo(() => {
    const m = {}
    inMonth.forEach((b) => { const k = ymd(startOfWeek(parseISO(b.slot_date))); (m[k] ||= []).push(b) })
    return Object.entries(m).sort().map(([k, list]) => [k, summarize(list)])
  }, [inMonth])
  const methods = inMonth.filter((b) => b.balance_paid != null).reduce((m, b) => ({ ...m, [b.balance_method || 'other']: (m[b.balance_method || 'other'] || 0) + b.balance_paid }), {})

  if (!rows) return <Skeleton lines={4} />
  const Stat = ({ label, value, strong }) => (
    <div className="rounded-2xl bg-ink/40 p-3">
      <div className="text-xs text-cream/60">{label}</div>
      <div className={`font-display text-2xl font-semibold ${strong ? 'text-rose' : ''}`}>{value}</div>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className="size-11 rounded-full text-xl hover:bg-cream/10">‹</button>
        <h1 className="font-display text-3xl font-semibold">{format(month, 'MMMM yyyy')}</h1>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="size-11 rounded-full text-xl hover:bg-cream/10">›</button>
      </div>
      {inMonth.length === 0 ? <EmptyState icon="₱" title="No bookings this month">Earnings appear here once appointments are booked.</EmptyState> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Money in</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total collected" value={peso(s.collected)} strong />
              <Stat label="Still to collect" value={peso(s.toCollect)} />
              <Stat label="Downpayments" value={peso(s.dp)} />
              <Stat label="Balances paid" value={peso(s.bal)} />
            </div>
            {Object.keys(methods).length > 0 && (
              <p className="text-xs text-cream/60">Balances by method: {Object.entries(methods).map(([k, v]) => `${k === 'gcash' ? 'GCash' : k === 'cash' ? 'Cash' : 'Other'} ${peso(v)}`).join(' · ')}</p>
            )}
            <p className="text-xs text-cream/50">Counted by appointment date. “Still to collect” is the balance left on approved bookings (using the final price, or the estimate if not set).</p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Appointments</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Sets completed" value={s.sets} />
              <Stat label="Value of completed sets" value={peso(s.value)} />
              <Stat label="No-shows" value={s.noShow} />
              <Stat label="Cancelled" value={s.cancelled} />
            </div>
            {s.kept > 0 && <p className="text-xs text-cream/60">Downpayments kept from no-shows / cancellations: {peso(s.kept)}</p>}
          </Card>
          <Card className="space-y-2 lg:col-span-2">
            <h2 className="font-display text-xl font-semibold">By week</h2>
            <div className="divide-y divide-cream/10 text-sm">
              {weeks.map(([k, w]) => (
                <div key={k} className="flex items-center justify-between py-2">
                  <span className="text-cream/70">Week of {format(parseISO(k), 'MMM d')}</span>
                  <span>{w.sets} done · <b className="text-rose">{peso(w.collected)}</b></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
