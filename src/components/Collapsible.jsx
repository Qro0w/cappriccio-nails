// Controlled accordion row. Parent decides which one is open (so only one is open at a time).
export default function Collapsible({ title, sub, right, open, onToggle, children, tone = 'card' }) {
  return (
    <div className={tone === 'card' ? 'rounded-2xl border border-cream/10 bg-wine/60' : ''}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-peach">{title}</span>
          {sub && !open && <span className="block truncate text-xs font-semibold text-cream/60">{sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm">
          {right}
          <span className={`text-cream/50 transition ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
