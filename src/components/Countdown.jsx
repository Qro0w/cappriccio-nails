import { useEffect, useRef, useState } from 'react'

export default function Countdown({ expiresAt, onExpire, className = '' }) {
  const target = new Date(expiresAt).getTime()
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()))
  const fired = useRef(false)

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, target - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      onExpire?.()
    }
  }, [left, onExpire])

  const s = Math.floor(left / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const urgent = left < 60 * 60 * 1000
  return (
    <span className={`font-mono font-semibold tabular-nums ${urgent ? 'text-red-300' : 'text-peach'} ${className}`}>
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  )
}
