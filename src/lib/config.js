// ---- Business constants. Change things here, not all over the app. ----
export const IG_URL = 'https://www.instagram.com/cappriccio.nails'
export const IG_HANDLE = '@cappriccio.nails'
export const CANCEL_CUTOFF_HOURS = 72 // client can self-cancel only if MORE than this many hours remain

export const SERVICES = {
  biab:     { label: 'BIAB (Builder In A Bottle)', short: 'BIAB',          group: 'Structured Manicure', ext: false },
  hardgel:  { label: 'Hard Gel Overlay',           short: 'Hard Gel Mani', group: 'Structured Manicure', ext: false },
  softgel:  { label: 'Soft Gel Extensions',        short: 'Soft Gel Ext',  group: 'Nail Extensions',     ext: true },
  hardgele: { label: 'Hard Gel Extensions',        short: 'Hard Gel Ext',  group: 'Nail Extensions',     ext: true },
}
export const LENGTHS = ['short', 'medium', 'long']

export const REMOVALS = {
  none:   { label: 'No removal',                            fee: 0 },
  soft:   { label: 'Soft gel removal (my work), new set',   fee: 100 },
  fill:   { label: 'Structured mani fill',                  fee: 80 },
  f_soft: { label: 'Foreign soft gel removal, new set',     fee: 200 },
  f_hard: { label: 'Foreign hard gel removal, new set',     fee: 300 },
}

export const INTENSIVE_FEE = 300
const BASE = {
  biab: 550,
  hardgel: 590,
  softgel:  { short: 580, medium: 620, long: 650 },
  hardgele: { short: 650, medium: 700, long: 750 },
}

// Structured fill is only for BIAB / Hard Gel mani
export const removalOptions = (service) =>
  Object.keys(REMOVALS).filter((k) => k !== 'fill' || ['biab', 'hardgel'].includes(service))

// Intensive manicure conditions (Booking doc "CONDITIONS")
export function intensiveAllowed(service, tier, removal) {
  tier = Number(tier)
  if (['biab', 'hardgel'].includes(service)) return tier === 1 || (tier === 2 && removal === 'none')
  if (['softgel', 'hardgele'].includes(service)) return tier === 1 && removal === 'none'
  return false
}

// Must match calc_price() in the database
export function calcPrice(service, length, removal, intensive) {
  if (!service || !removal) return null
  const b = BASE[service]
  const base = typeof b === 'number' ? b : b?.[length]
  if (base == null) return null
  return base + REMOVALS[removal].fee + (intensive ? INTENSIVE_FEE : 0)
}

export const STATUS = {
  awaiting_payment:  { label: 'Awaiting downpayment', cls: 'bg-amber-400/20 text-amber-200 border-amber-300/40' },
  payment_submitted: { label: 'Receipt submitted',    cls: 'bg-sky-400/20 text-sky-200 border-sky-300/40' },
  confirmed:         { label: 'Confirmed',            cls: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40' },
  completed:         { label: 'Completed',            cls: 'bg-cream/10 text-cream/80 border-cream/30' },
  cancelled:         { label: 'Cancelled',            cls: 'bg-red-400/15 text-red-200 border-red-300/30' },
  rejected:          { label: 'Rejected',             cls: 'bg-red-400/15 text-red-200 border-red-300/30' },
  expired:           { label: 'Expired',              cls: 'bg-cream/10 text-cream/60 border-cream/20' },
  no_show:           { label: 'No show',              cls: 'bg-red-400/15 text-red-200 border-red-300/30' },
}
export const ACTIVE = ['awaiting_payment', 'payment_submitted', 'confirmed']

export const PRESET_TIMES = ['09:00', '11:00', '12:00', '13:00', '14:30', '16:00', '17:00']
