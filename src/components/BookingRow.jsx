import { Link } from 'react-router-dom'
import { REMOVALS, SERVICES } from '../lib/config'
import { balanceOf, fmtDate, fmtTime, peso } from '../lib/format'
import { StatusBadge } from './ui'
import Countdown from './Countdown'

export default function BookingRow({ b, showDate = false, onExpire, checkHours = 12 }) {
  const waited = b.status === 'payment_submitted' && b.receipt_uploaded_at ? (Date.now() - new Date(b.receipt_uploaded_at)) / 36e5 : 0
  return (
    <Link to={`/admin/booking/${b.id}`} className="block space-y-1 rounded-2xl border border-cream/10 bg-ink/40 p-4 active:bg-cream/10">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {showDate && <span className="text-rose">{fmtDate(b.slot_date)} · </span>}
          {fmtTime(b.slot_time)} · {b.full_name}
        </span>
        <StatusBadge status={b.status} />
      </div>
      <div className="text-xs text-cream/70">
        {SERVICES[b.service].short}{b.length ? ` · ${b.length}` : ''} · Tier {b.tier} · {REMOVALS[b.removal].label}{b.intensive ? ' · Intensive' : ''}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs">
        {b.age < 15 && <span className="font-semibold text-amber-200">⚑ Under 15</span>}
        {b.status === 'awaiting_payment' && <span>⏳ <Countdown expiresAt={b.expires_at} onExpire={onExpire} /> left to pay</span>}
        {b.status === 'payment_submitted' && (waited >= checkHours
          ? <span className="font-semibold text-peach">⚠ Receipt waiting {Math.floor(waited)}h, please check</span>
          : <span className="text-sky-200">🧾 Receipt uploaded, needs your check</span>)}
        {b.receipt_path && b.status !== 'payment_submitted' && <span className="text-cream/60">🧾 Receipt on file</span>}
        {b.dp_amount != null && ['payment_submitted', 'confirmed'].includes(b.status) && <span className="text-cream/80">Left to pay {peso(balanceOf(b.final_price, b.estimated_price, b.dp_amount).left)}</span>}
      </div>
    </Link>
  )
}
