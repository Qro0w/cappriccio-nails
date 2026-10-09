import { Link } from 'react-router-dom'
import { AFTER_RESERVE } from '../../lib/content'
import { IG_URL, IG_HANDLE } from '../../lib/config'
import { Btn, Shell } from '../../components/ui'

export default function Home() {
  return (
    <Shell hideHeader>
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center gap-10 pt-6">
        <div className="relative mx-auto flex flex-col items-center text-center">
          <div className="lamp-glow absolute -top-16 size-80 rounded-full" />
          <h1 className="relative font-display text-[3.6rem] font-bold leading-[0.9] text-cream">
            Cappriccio<br /><span className="italic text-rose">Nails</span>
          </h1>
          <div className="wood relative mt-5 h-1.5 w-28 rounded-full opacity-90" />
          <a href={IG_URL} target="_blank" rel="noreferrer" className="relative mt-2 inline-block min-h-11 py-2 text-sm font-semibold text-peach">{IG_HANDLE}</a>
        </div>

        <div className="space-y-3">
          <Btn as={Link} to="/book" className="w-full !min-h-14 !text-lg">Book an appointment</Btn>
          <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
          <Btn as={Link} to="/policies" variant="ghost" className="w-full">View policies</Btn>
        </div>

        <div className="space-y-1 text-center">
          <p className="px-4 text-xs text-cream/60">{AFTER_RESERVE}</p>
          <Link to="/forgot-code" className="inline-block min-h-11 pt-2 text-sm font-semibold text-cream underline underline-offset-4">Forgot my booking code</Link>
        </div>
      </div>
    </Shell>
  )
}
