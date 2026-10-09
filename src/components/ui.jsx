import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS } from '../lib/config'

export const Card = ({ className = '', ...p }) => (
  <div className={`rounded-3xl border border-cream/10 bg-wine/60 p-5 backdrop-blur ${className}`} {...p} />
)

const VARIANTS = {
  primary: 'bg-rose text-ink shadow-[0_3px_0_#b8707c] active:translate-y-0.5 active:shadow-none hover:bg-rose/90',
  soft: 'boucle shadow-[0_3px_0_#b89a72] active:translate-y-0.5 active:shadow-none',
  ghost: 'border-[1.5px] border-cream/15 bg-ink/35 text-cream hover:bg-cream/5',
  danger: 'bg-red-700 text-white hover:bg-red-600',
}
export const Btn = ({ variant = 'primary', className = '', as: As = 'button', ...p }) => (
  <As
    className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    {...p}
  />
)

export const inputCls =
  'w-full min-h-12 rounded-2xl border border-cream/20 bg-ink/60 px-4 text-base text-cream placeholder:text-cream/40 focus:border-rose focus:outline-none'

export const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-sm font-semibold text-peach">{label}</span>
    {children}
    {hint && <span className="block text-xs text-cream/60">{hint}</span>}
  </label>
)

export function Shell({ children, wide = false, hideHeader = false }) {
  return (
    <div className={`mx-auto min-h-dvh px-4 pb-16 pt-4 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
      {!hideHeader && (
        <header className="mb-6 text-center">
          <Link to="/" className="font-display text-3xl font-bold text-cream">
            Cappriccio <span className="italic text-rose">Nails</span>
          </Link>
          <div className="wood mx-auto mt-2 h-1 w-16 rounded-full opacity-90" />
        </header>
      )}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm space-y-3 rounded-3xl border border-cream/15 bg-wine p-5 shadow-2xl">
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

export const BackLink = ({ to, onClick, children = 'Back' }) =>
  to ? (
    <Link to={to} className="inline-flex min-h-11 items-center text-sm font-semibold text-peach">← {children}</Link>
  ) : (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center text-sm font-semibold text-peach">← {children}</button>
  )

export const Switch = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? 'bg-rose' : 'bg-cream/20'}`}>
    <span className={`absolute top-1 size-6 rounded-full bg-ink shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
  </button>
)

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(text) } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      t.remove()
    }
    setDone(true); setTimeout(() => setDone(false), 1800)
  }
  return <Btn variant="soft" className={`!min-h-11 px-4 text-sm ${className}`} onClick={copy}>{done ? '✓ Copied' : `⧉ ${label}`}</Btn>
}
