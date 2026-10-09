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
