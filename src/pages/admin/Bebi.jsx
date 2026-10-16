import Phrases from '../../components/Phrases'
import bebi from '../../assets/bebi.webp'

// Just for her ♡
export default function Bebi() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rise-in relative overflow-hidden rounded-[32px] border border-cream/15 shadow-2xl">
        <img src={bebi} alt="Bebi" className="block h-auto w-full" />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-[#1e040c]/90 via-[#1e040c]/55 to-transparent px-4 pb-16 pt-5">
          <Phrases />
        </div>
      </div>
    </div>
  )
}
