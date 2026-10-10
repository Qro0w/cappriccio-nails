// Loading placeholders, empty states and the little success check.

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  )
}

export function EmptyState({ icon = '✿', title, children }) {
  return (
    <div className="anim-in flex flex-col items-center gap-1 rounded-3xl border border-dashed border-cream/15 px-6 py-8 text-center">
      <div className="text-2xl text-rose/80" aria-hidden="true">{icon}</div>
      <div className="font-display text-lg text-cream">{title}</div>
      {children && <div className="text-sm text-cream/60">{children}</div>}
    </div>
  )
}

// Animated check mark + a few sparkles. Plays once.
export function SuccessBurst({ title, children }) {
  return (
    <div className="pop-in flex flex-col items-center gap-2 py-2 text-center" role="status">
      <div className="relative size-20">
        <svg viewBox="0 0 80 80" className="size-20" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-cream)" strokeOpacity=".25" strokeWidth="3" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-rose)" strokeWidth="3" strokeLinecap="round" className="draw-ring" />
          <path d="M26 41 l9 9 l19 -20" fill="none" stroke="var(--color-cream)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
        </svg>
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="sparkle" style={{ '--a': `${i * 60}deg` }} aria-hidden="true" />)}
      </div>
      <div className="font-display text-2xl font-semibold">{title}</div>
      {children && <div className="text-sm text-cream/75">{children}</div>}
    </div>
  )
}
