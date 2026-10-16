import { useEffect, useMemo, useState } from 'react'
import Phrases from '../../components/Phrases'

// Just for her ♡ — a polaroid wall that fills in one by one, then keeps swapping photos.
const PHOTOS = Object.values(import.meta.glob('../../assets/bebi/*.webp', { eager: true, import: 'default' }))

// Six spots (2 columns × 3 rows). Sized and spaced so tilted polaroids never touch.
const SLOTS = [
  { x: 4, y: 0, r: -4 }, { x: 54, y: 3, r: 3.5 },
  { x: 5, y: 34, r: 3 }, { x: 53, y: 37, r: -3.5 },
  { x: 4, y: 68, r: -2.5 }, { x: 54, y: 71, r: 4 },
]
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map((p) => p[1])

export default function Bebi() {
  const order = useMemo(() => shuffle(PHOTOS.map((_, i) => i)), [])
  const [shown, setShown] = useState(0) // how many polaroids are on the wall so far
  const [pics, setPics] = useState(() => SLOTS.map((_, i) => order[i % order.length]))
  const [next, setNext] = useState(SLOTS.length % order.length)

  // Put them up one by one
  useEffect(() => {
    if (shown >= SLOTS.length) return undefined
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 650)
    return () => clearTimeout(id)
  }, [shown])

  // Then keep cycling: swap one polaroid for the next photo every few seconds
  useEffect(() => {
    if (shown < SLOTS.length || PHOTOS.length <= SLOTS.length) return undefined
    const id = setInterval(() => {
      setPics((cur) => {
        const slot = Math.floor(Math.random() * SLOTS.length)
        let n = next
        while (cur.includes(order[n % order.length])) n++
        const out = [...cur]
        out[slot] = order[n % order.length]
        setNext((n + 1) % order.length)
        return out
      })
    }, 3200)
    return () => clearInterval(id)
  }, [shown, next, order])

  return (
    <div className="mx-auto max-w-md">
      <div className="rise-in overflow-hidden rounded-[32px] border border-cream/15 bg-plum/50 px-3 pb-6 pt-4 shadow-2xl">
        <Phrases />
        {/* the wall: kept below the message so photos never cover it */}
        <div className="relative mt-4 w-full" style={{ aspectRatio: '1 / 1.8' }}>
          {SLOTS.slice(0, shown).map((s, i) => (
            <div key={`${i}-${pics[i]}`} className="polaroid absolute w-[42%]"
              style={{ left: `${s.x}%`, top: `${s.y}%`, '--r': `${s.r}deg` }}>
              <div className="rounded-[3px] bg-[#fbf6ee] p-[6%] pb-[22%] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]">
                <img src={PHOTOS[pics[i]]} alt="" className="aspect-square w-full object-cover" style={{ objectPosition: 'center 30%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
