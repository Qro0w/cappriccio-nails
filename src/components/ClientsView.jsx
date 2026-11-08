import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { fmtTime, peso, ymd } from '../lib/format'
import { REMOVALS, SERVICES, STATUS } from '../lib/config'
import { buildClients, normPhone } from '../lib/clients'
import { drawClients } from '../lib/clientsImage'
import { loadStoryAssets } from '../lib/storyImage'
import { useRemembered } from '../lib/remember'
import { Btn, Card } from './ui'
import { EmptyState, Skeleton } from './Feedback'

const COLS = 'id,code,status,slot_date,slot_time,full_name,instagram,phone,service,removal,tier,dp_amount,balance_paid'
const short = (d) => (d ? format(parseISO(d), 'MMM d') : '—')
const STATUS_TEXT = { completed: 'text-emerald-300', cancelled: 'text-red-300', rejected: 'text-red-300', no_show: 'text-red-300', expired: 'text-cream/50' }

// Earnings → Clients: everyone who has booked, ranked by completed visits.
export default function ClientsView() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useRemembered('cl.q', '')
  const [openKey, setOpenKey] = useRemembered('cl.open', null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('bookings').select(COLS).then(({ data, error }) => {
      if (error) setErr('Could not load clients. Please try again.')
      setRows(data || [])
    })
  }, [])

  const clients = useMemo(() => buildClients(rows || []), [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return clients
    const digits = normPhone(t)
    return clients.filter((c) => c.ig.toLowerCase().includes(t.replace(/^@/, '')) || c.name.toLowerCase().includes(t) || (digits.length >= 3 && c.key.includes(digits)))
  }, [clients, q])
  const rank = useMemo(() => new Map(clients.map((c, i) => [c.key, i])), [clients])
  const open = clients.find((c) => c.key === openKey)
  const totalVisits = clients.reduce((s, c) => s + c.visits, 0)

  async function download() {
    const top = clients.filter((c) => c.visits > 0).slice(0, 20)
    if (!top.length) return setErr('No completed visits yet, so there’s nothing to put on the list.')
    setBusy(true); setErr('')
    const canvas = document.createElement('canvas')
    const assets = await loadStoryAssets()
    drawClients(canvas, {
      rows: top.map((c) => ({ ig: c.ig || c.name, phone: c.phone, visits: c.visits, last: short(c.last) })),
      subtitle: `TOP ${top.length} · BY COMPLETED VISITS · AS OF ${format(new Date(), 'MMM yyyy').toUpperCase()}`,
    }, assets)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
    setBusy(false)
    if (!blob) return setErr('Could not make the image. Please try again.')
    const name = `cappriccio-top-clients-${ymd(new Date())}.png`
    const file = new File([blob], name, { type: 'image/png' })
    if (window.matchMedia?.('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }) } catch { /* cancelled */ }
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  if (!rows) return <Skeleton lines={5} />
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Clients</h2>
          <span className="text-xs text-cream/55">{clients.length} client{clients.length === 1 ? '' : 's'} · {totalVisits} visit{totalVisits === 1 ? '' : 's'}</span>
        </div>
        {err && <p className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</p>}
        {clients.length === 0 ? (
          <EmptyState icon="♡" title="No clients yet">Clients appear here once people start booking.</EmptyState>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Instagram or number" inputMode="search"
              className="min-h-11 w-full rounded-2xl border border-cream/20 bg-ink/50 px-4 text-base focus:border-rose focus:outline-none" />
            {shown.length === 0 && <p className="py-4 text-center text-sm text-cream/60">No client matches “{q}”.</p>}
            <div className="divide-y divide-cream/10">
              {shown.map((c) => {
                const i = rank.get(c.key), top = i < 3 && c.visits > 0
                return (
                  <button key={c.key} onClick={() => setOpenKey(c.key)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className={`w-7 shrink-0 text-center font-display text-2xl italic ${top ? 'text-rose' : 'text-rose/60'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.ig || c.name}</span>
                      <span className="block truncate text-xs text-cream/55">{c.ig ? `${c.name} · ` : ''}{c.phone}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-cream/55">
                      <span className="block">{c.last ? `Last ${short(c.last)}` : 'No visits yet'}</span>
                      <span className="block">{peso(c.paid)}</span>
                    </span>
                    <span className={`flex h-8 min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold ${top ? 'bg-cream text-ink' : 'bg-cream/10'}`}>{c.visits}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
        <p className="text-xs text-cream/50">Sorted by completed visits. Cancelled, rejected, expired and no-show bookings don’t count as visits. “Paid” = downpayments kept + balances paid.</p>
      </Card>
      {clients.length > 0 && (
        <div className="sticky bottom-24 z-10">
          <Btn className="w-full gap-2 shadow-2xl" disabled={busy} onClick={download}>{busy ? 'Making the image…' : '⤓ Download top 20 (PNG)'}</Btn>
        </div>
      )}
      {open && <ClientSheet c={open} onClose={() => setOpenKey(null)} />}
    </div>
  )
}

function ClientSheet({ c, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={`${c.ig || c.name} details`} onClick={(e) => e.stopPropagation()}
        className="rise-in max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-t-[28px] border border-cream/15 bg-[#1a050b] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-2xl font-semibold">{c.ig || c.name}</div>
            <div className="text-sm text-cream/60">{c.ig ? `${c.name} · ` : ''}{c.phone}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full text-cream/70 hover:bg-cream/10">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-cream/5 p-3"><div className="text-xs text-cream/55">Visits</div><div className="font-display text-2xl text-rose">{c.visits}</div></div>
          <div className="rounded-2xl bg-cream/5 p-3"><div className="text-xs text-cream/55">Paid</div><div className="font-display text-xl leading-8">{peso(c.paid)}</div></div>
          <div className="rounded-2xl bg-cream/5 p-3"><div className="text-xs text-cream/55">Client since</div><div className="font-display text-xl leading-8">{c.first ? format(parseISO(c.first), 'MMM yyyy') : '—'}</div></div>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold text-peach">Bookings</div>
          <div className="divide-y divide-cream/10">
            {c.bookings.map((b) => (
              <Link key={b.id} to={`/admin/booking/${b.id}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{format(parseISO(b.slot_date), 'MMM d, yyyy')} · {fmtTime(b.slot_time)}</span>
                  <span className="block truncate text-xs text-cream/55">{SERVICES[b.service]?.short || b.service} · {REMOVALS[b.removal]?.label || 'No removal'} · Tier {b.tier}</span>
                </span>
                <span className={`shrink-0 text-xs font-semibold ${STATUS_TEXT[b.status] || 'text-peach'}`}>{STATUS[b.status]?.label || b.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
