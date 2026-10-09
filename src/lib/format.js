import { format, parseISO } from 'date-fns'

// Postgres gives time as "HH:MM:SS"
export const fmtTime = (t) => format(new Date(`2000-01-01T${t.slice(0, 8)}`), 'h:mm a')
export const fmtDate = (d) => format(parseISO(d), 'EEE, MMM d')
export const fmtDateLong = (d) => format(parseISO(d), 'EEEE, MMMM d, yyyy')
export const peso = (n) => '₱' + Number(n).toLocaleString('en-PH')
export const ymd = (d) => format(d, 'yyyy-MM-dd')
// Slots are always Philippine time (UTC+8, no daylight saving)
export const slotStart = (d, t) => new Date(`${d}T${t.slice(0, 8)}+08:00`)
export const hoursUntil = (d, t) => (slotStart(d, t) - Date.now()) / 36e5
export const cleanIg = (v) =>
  '@' + v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').replace(/^@/, '')
export const cleanPhone = (v) => v.replace(/[\s-]/g, '')
export const validPhone = (v) => /^(09|\+639|639)\d{9}$/.test(cleanPhone(v))

// "1 Day, 03:24:13"  /  "2 Days, 00:10:05"  /  "03:24:13"
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const p = (n) => String(n).padStart(2, '0')
  const clock = `${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
  return d > 0 ? `${d} ${d === 1 ? 'Day' : 'Days'}, ${clock}` : clock
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
