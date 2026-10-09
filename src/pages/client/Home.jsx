import { Link } from 'react-router-dom'
import { IG_HANDLE, IG_URL } from '../../lib/config'
import { Btn, Card, Shell } from '../../components/ui'

export default function Home() {
  return (
    <Shell>
      <div className="space-y-4 pt-6 text-center">
        <p className="font-display text-xl italic text-peach">Book your set in a few taps</p>
        <Btn as={Link} to="/book" className="w-full !text-lg">Book an appointment</Btn>
        <Btn as={Link} to="/my-booking" variant="ghost" className="w-full">View my booking</Btn>
        <Card className="space-y-2 text-left text-sm">
          <p>✨ No account needed. First come, first served.</p>
          <p>⏳ After you reserve a slot you have <b>12 hours</b> to send your downpayment (min ₱400) and upload the receipt.</p>
          <p>
            💬 Please send your design inspo to{' '}
            <a href={IG_URL} target="_blank" rel="noreferrer" className="font-semibold text-rose underline">{IG_HANDLE}</a> on Instagram.
          </p>
        </Card>
      </div>
    </Shell>
  )
}
