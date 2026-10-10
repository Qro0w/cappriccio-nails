import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS } from '../lib/config'
import { CornerWaves, Logo } from './Decor'

export const Card = ({ className = '', ...p }) => (
  <div className={`rounded-3xl border border-cream/20 bg-plum/55 p-5 backdrop-blur ${className}`} {...p} />
)

const VARIANTS = {
  primary: 'bg-cream text-[#3a0817] hover:bg-cream/90 active:scale-[0.99]',
  soft: 'bg-rose text-[#3a0817] hover:bg-rose/90 active:scale-[0.99]',
  ghost: 'border-[1.5px] border-rose/70 bg-ink/40 text-cream hover:bg-rose/10',
  danger: 'bg-red-700 text-white hover:bg-red-600',
}
export const Btn = ({ variant = 'primary', className = '', as: As = 'button', ...p }) => (
  <As
    className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-center font-display text-[1.05rem] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    {...p}
  />
)

export const inputCls =
  'w-full min-h-12 rounded-2xl border border-cream/20 bg-ink/50 px-4 text-base text-cream placeholder:text-cream/40 focus:border-rose focus:outline-none'

export const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-sm font-semibold text-peach">{label}</span>
    {children}
    {hint && <span className="block text-xs text-cream/60">{hint}</span>}
  </label>
)

export function Shell({ children, wide = false, hideHeader = false }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <CornerWaves big={hideHeader} bottom={hideHeader} />
      <div className={`relative mx-auto min-h-dvh px-4 pb-16 pt-5 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        {!hideHeader && (
          <header className="relative mb-4 flex justify-center">
            <div className="logo-glow pointer-events-none absolute -top-16 h-52 w-80 rounded-full" />
            <Link to="/" aria-label="Cappriccio Nails home" className="relative"><Logo /></Link>
          </header>
        )}
        {children}
      </div>
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
      <div className="w-full max-w-sm space-y-3 rounded-3xl border border-cream/20 bg-[#2a0612] p-5 shadow-2xl">
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
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
