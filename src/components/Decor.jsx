// Brand pieces shared by the client and nailtech pages:
//   <Logo />         the logo: size="lg" = main landing logo, default = small arch logo
//   <CornerWaves />  the soft cream shapes in the corners
// The dark gradient and the faint cream streaks live in index.css (body), so every page gets them.

export function Logo({ size = 'sm', className = '' }) {
  // lg / md = the arch logo (client landing page / nailtech login)
  // sm      = the music-note wordmark, at the top of every other page
  if (size === 'lg' || size === 'md') {
    return (
      <img src="/logo-arch.webp" alt="Cappriccio Nails" width={407} height={560}
        className={`block w-auto ${size === 'lg' ? 'h-[min(16rem,42vh)]' : 'h-[min(13rem,34vh)]'} drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] ${className}`} />
    )
  }
  return (
    <img src="/logo-note.webp" alt="Cappriccio Nails" width={600} height={218}
      className={`block h-auto w-[11rem] drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${className}`} />
  )
}

const CREAM = '#f3e6d0'
export function CornerWaves({ big = false, bottom = false }) {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 130 120" className={`pointer-events-none absolute left-0 top-0 ${big ? 'w-[130px]' : 'w-[86px]'}`}>
        <path d="M0 0 L0 120 C40 110 50 70 90 60 C120 52 120 15 130 0 Z" fill={CREAM} />
      </svg>
      {bottom && (
        <svg aria-hidden="true" viewBox="0 0 132 130" className={`pointer-events-none absolute bottom-0 right-0 ${big ? 'w-[132px]' : 'w-[90px]'}`}>
          <path d="M132 130 L132 0 C92 15 82 55 42 65 C12 73 10 110 0 130 Z" fill={CREAM} />
        </svg>
      )}
    </>
  )
}
