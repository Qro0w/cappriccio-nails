import { Link } from 'react-router-dom'
import { AFTER_RESERVE } from '../../lib/content'
import { IG_URL, IG_HANDLE } from '../../lib/config'
import { Btn, Shell } from '../../components/ui'
import { Logo } from '../../components/Decor'

export default function Home() {
  return (
    <Shell hideHeader>
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center gap-9 px-4 pt-6">
        <div className="relative flex flex-col items-center text-center">
          <div className="logo-glow pointer-events-none absolute -top-28 size-[22rem] rounded-full" />
          <h1 className="relative"><Logo size="lg" /></h1>
          <a href={IG_URL} target="_blank" rel="noreferrer" className="relative mt-3 inline-block min-h-11 py-2 font-display text-[1.05rem] text-cream">{IG_HANDLE}</a>
        </div>

        <div className="space-y-3">
          <Btn as={Link} to="/book" className="w-full !min-h-14 !text-lg">Book an appointment</Btn>
          <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
          <Btn as={Link} to="/policies" variant="ghost" className="w-full">View policies</Btn>
        </div>

        <div className="space-y-1 text-center">
          <p className="px-2 font-display text-[0.8rem] text-cream/75">{AFTER_RESERVE}</p>
          <Link to="/forgot-code" className="inline-block min-h-11 pt-2 font-display text-sm text-cream underline underline-offset-4">Forgot my booking code</Link>
        </div>
      </div>
    </Shell>
  )
}
