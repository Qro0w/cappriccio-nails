import { Link } from 'react-router-dom'
import { AFTER_RESERVE } from '../../lib/content'
import { Btn, Shell } from '../../components/ui'

export default function Home() {
  return (
    <Shell>
      <div className="space-y-3 pt-8 text-center">
        <Btn as={Link} to="/book" className="w-full !text-lg">Book an appointment</Btn>
        <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
        <Btn as={Link} to="/policies" variant="ghost" className="w-full">View policies</Btn>
        <p className="px-4 pt-3 text-xs text-cream/60">{AFTER_RESERVE}</p>
        <Link to="/forgot-code" className="inline-block min-h-11 pt-2 text-sm text-peach underline">Forgot my booking code</Link>
      </div>
    </Shell>
  )
}
