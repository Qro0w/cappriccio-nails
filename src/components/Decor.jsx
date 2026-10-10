// Brand pieces shared by the client and nailtech pages:
//   <Logo />         the Cappriccio logo (image) with "Nails" in Playfair italic
//   <CornerWaves />  the soft cream shapes in the corners
// The dark gradient and the faint cream streaks live in index.css (body), so every page gets them.

export function Logo({ size = 'sm', className = '' }) {
  const lg = size === 'lg'
  return (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <img src="/logo-cappriccio.webp" alt="Cappriccio" width={lg ? 262 : 150} height={lg ? 71 : 41}
        className="block h-auto drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)]" style={{ width: lg ? 262 : 150 }} />
      <span className={`self-end font-display font-medium italic leading-[0.9] text-rose ${lg ? '-mt-1.5 mr-[6%] text-[3.6rem]' : '-mt-0.5 mr-[6%] text-[2rem]'}`}>Nails</span>
    </span>
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
