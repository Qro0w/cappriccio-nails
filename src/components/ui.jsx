import { Link } from 'react-router-dom'
import { STATUS } from '../lib/config'

export const Card = ({ className = '', ...p }) => (
  <div className={`rounded-2xl border border-cream/10 bg-wine/60 p-4 backdrop-blur ${className}`} {...p} />
)

const VARIANTS = {
  primary: 'bg-maroon text-cream border border-rose/30 hover:bg-maroon/80',
  soft: 'bg-rose text-ink hover:bg-rose/85',
  ghost: 'border border-cream/25 text-cream hover:bg-cream/10',
  danger: 'bg-red-800 text-white hover:bg-red-700',
}
export const Btn = ({ variant = 'primary', className = '', as: As = 'button', ...p }) => (
  <As
    className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    {...p}
  />
)

export const inputCls =
  'w-full min-h-12 rounded-xl border border-cream/20 bg-ink/60 px-3 text-base text-cream placeholder:text-cream/40 focus:border-rose focus:outline-none'

export const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-sm text-peach">{label}</span>
    {children}
    {hint && <span className="block text-xs text-cream/60">{hint}</span>}
  </label>
)

export function Shell({ children, wide = false }) {
  return (
    <div className={`mx-auto min-h-dvh px-4 pb-16 pt-4 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
      <header className="mb-5 text-center">
        <Link to="/" className="font-display text-3xl font-bold tracking-wide text-cream">
          Cappriccio <span className="text-rose">Nails</span>
        </Link>
      </header>
      {children}
    </div>
  )
}

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || { label: status, cls: '' }
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Yes, continue', danger, busy, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-cream/15 bg-wine p-5">
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        <p className="text-sm text-cream/80">{body}</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Btn variant="ghost" onClick={onCancel} disabled={busy}>Go back</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export const ErrorText = ({ children }) =>
  children ? <p className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{children}</p> : null
