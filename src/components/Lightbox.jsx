import { useEffect } from 'react'

// Full-screen image viewer. images = [url,...]; index/onIndex controlled by parent. Swipe-friendly arrows + keyboard.
export default function Lightbox({ images, index, onIndex, onClose }) {
  const n = images.length
  useEffect(() => {
    if (index == null) return undefined
    const k = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % n)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [index, n, onIndex, onClose])
  if (index == null || !n) return null
  let x0 = null
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      onTouchStart={(e) => { x0 = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (x0 == null || n < 2) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) onIndex((index + (dx < 0 ? 1 : -1) + n) % n) }}>
      <div className="flex items-center justify-between p-3 text-sm text-cream/80">
        <span>{n > 1 ? `${index + 1} / ${n}` : ''}</span>
        <button onClick={onClose} className="min-h-11 rounded-xl px-4 font-semibold">Close ✕</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={onClose}>
        <img src={images[index]} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        {n > 1 && (
          <>
            <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + n) % n) }} className="absolute left-1 size-12 rounded-full bg-black/50 text-2xl">‹</button>
            <button aria-label="Next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % n) }} className="absolute right-1 size-12 rounded-full bg-black/50 text-2xl">›</button>
          </>
        )}
      </div>
    </div>
  )
}
