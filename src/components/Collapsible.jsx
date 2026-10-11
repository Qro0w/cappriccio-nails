import { Chevron } from './Select'

// Smoothly opens/closes its children (height + fade). Content stays mounted so it can animate out.
export function Reveal({ open, children, className = '' }) {
  return (
    <div className={`reveal ${open ? 'is-open' : ''}`} inert={!open || undefined} aria-hidden={!open}>
      <div className="min-h-0 overflow-hidden">
        <div className={`reveal-inner ${className}`}>{children}</div>
      </div>
    </div>
  )
}

// Controlled accordion row. Parent decides which one is open (so only one is open at a time).
export default function Collapsible({ title, sub, right, open, onToggle, children, tone = 'card' }) {
  return (
    <div className={tone === 'card' ? 'rounded-3xl border border-cream/20 bg-plum/55' : ''}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-peach">{title}</span>
          {sub && (
            <span className={`grid transition-all duration-300 ${open ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <span className="block min-h-0 truncate overflow-hidden text-xs font-semibold text-cream/60">{sub}</span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm">
          {right}
          <Chevron open={open} className="text-cream/50" />
        </span>
      </button>
      <Reveal open={open} className="px-4 pb-4">{children}</Reveal>
    </div>
  )
}
