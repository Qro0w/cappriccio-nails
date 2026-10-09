import { Link } from 'react-router-dom'
import { AFTER_RESERVE } from '../../lib/content'
import { Btn, Shell } from '../../components/ui'

export default function Home() {
  return (
    <Shell>
      <div className="space-y-4 pt-8 text-center">
        <Btn as={Link} to="/book" className="w-full !text-lg">Book an appointment</Btn>
        <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
        <p className="px-4 pt-2 text-xs text-cream/60">{AFTER_RESERVE}</p>
      </div>
    </Shell>
  )
}
