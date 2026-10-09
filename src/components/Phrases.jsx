import { useEffect, useState } from 'react'

export const LOVE_LINES = [
  'HAVE A GREAT DAY TODAY BABU',
  'I LOVE THE BABULABU',
  'REMEMBER TO EAT',
  'YOU SHALL CONQUER TODAY',
]

// Slowly swaps between the lines (fade + rise). Starts on a random line each visit.
export default function Phrases({ lines = LOVE_LINES, every = 4200, className = '' }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * lines.length))
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % lines.length), every)
    return () => clearInterval(id)
  }, [lines.length, every])
  return (
    <div className={`flex min-h-[4.5rem] items-center justify-center ${className}`} aria-live="polite">
      <p key={i} className="phrase-in text-balance text-center font-display text-[1.9rem] font-bold uppercase leading-tight text-rose drop-shadow-[0_2px_12px_rgb(246_165_176/0.25)]">
        {lines[i]} <span className="text-peach">♡</span>
      </p>
    </div>
  )
}
