// Groups bookings into clients for the Clients page (and, later, the "regulars only" check).
// A client = one phone number. 0917…, +63917…, 63917… and 917… all count as the same person.
export const normPhone = (v = '') => {
  const d = String(v).replace(/\D/g, '')
  if (d.startsWith('63') && d.length === 12) return d.slice(2)
  if (d.startsWith('0') && d.length === 11) return d.slice(1)
  return d
}
export const showPhone = (key) => (key.length === 10 ? `0${key.slice(0, 3)} ${key.slice(3, 6)} ${key.slice(6)}` : key)

const PAID = ['confirmed', 'completed', 'no_show', 'cancelled'] // same rule as Earnings
export const paidOf = (b) => (PAID.includes(b.status) && b.dp_amount != null ? b.dp_amount : 0) + (b.balance_paid || 0)

// Only COMPLETED appointments count as visits.
export function buildClients(bookings) {
  const m = new Map()
  for (const b of bookings) {
    const key = normPhone(b.phone)
    if (!key) continue
    const c = m.get(key) || { key, phone: showPhone(key), bookings: [], visits: 0, paid: 0, last: null, first: null }
    c.bookings.push(b)
    c.paid += paidOf(b)
    if (b.status === 'completed') {
      c.visits++
      if (!c.last || b.slot_date > c.last) c.last = b.slot_date
      if (!c.first || b.slot_date < c.first) c.first = b.slot_date
    }
    m.set(key, c)
  }
  const list = [...m.values()]
  for (const c of list) {
    c.bookings.sort((a, b) => (b.slot_date + b.slot_time).localeCompare(a.slot_date + a.slot_time))
    const latest = c.bookings[0] // newest Instagram handle / name they used
    c.ig = latest.instagram || ''
    c.name = latest.full_name || ''
  }
  // most visits first; ties → most recent visit, then name
  return list.sort((a, b) => b.visits - a.visits || (b.last || '').localeCompare(a.last || '') || a.name.localeCompare(b.name))
}
