import { Link } from 'react-router-dom'
import { AFTER_RESERVE } from '../../lib/content'
import { IG_URL, IG_HANDLE } from '../../lib/config'
import { Btn, Shell } from '../../components/ui'
import { Logo } from '../../components/Decor'
import { IgIcon } from '../../components/Icons'
import Rich from '../../components/Rich'

export default function Home() {
  return (
    <Shell hideHeader>
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center gap-9 px-4 pt-6">
        <div className="relative flex flex-col items-center text-center">
          <div className="logo-glow pointer-events-none absolute -top-28 size-[22rem] rounded-full" />
          <h1 className="pop-in relative"><span className="float block"><Logo size="lg" /></span></h1>
          <a href={IG_URL} target="_blank" rel="noreferrer" className="anim-in relative mt-3 inline-flex min-h-11 items-center gap-1.5 py-2 font-display text-[1.05rem] text-cream [animation-delay:150ms]"><IgIcon className="text-rose" />{IG_HANDLE}</a>
        </div>

        <div className="anim-in space-y-3 [animation-delay:250ms]">
          <Btn as={Link} to="/book" className="w-full !min-h-14 !text-lg">Book an appointment</Btn>
          <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
          <Btn as={Link} to="/policies" variant="ghost" className="w-full">View policies</Btn>
        </div>

        <div className="anim-in space-y-1 text-center [animation-delay:400ms]">
          <p className="px-2 font-display text-[0.8rem] text-cream/75"><Rich text={AFTER_RESERVE} /></p>
          <Link to="/forgot-code" className="inline-block min-h-11 pt-2 font-display text-sm text-cream underline underline-offset-4">Forgot my booking code</Link>
        </div>
      </div>
    </Shell>
  )
}
