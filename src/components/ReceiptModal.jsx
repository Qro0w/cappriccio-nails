import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Receipt viewer: a centred pop-up with a big close button, kept clear of the phone's
// status bar / notch. Tap outside, the ✕, "Close" or Esc to exit.
export default function ReceiptModal({ url, open, onClose, title = 'Receipt' }) {
  useEffect(() => {
    if (!open) return undefined
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open || !url) return null
  return createPortal(
    <div className="fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))' }}
      onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="rise-in flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-cream/15 bg-[#1a050b] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cream/10 px-4 py-2">
          <h3 className="font-display text-xl font-semibold">🧾 {title}</h3>
          <button onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-cream/10 text-lg text-cream hover:bg-cream/20">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-black/40 p-2">
          <img src={url} alt={title} className="mx-auto block h-auto w-full rounded-xl object-contain" />
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-cream/10 p-3">
          <a href={url} target="_blank" rel="noreferrer"
            className="flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-rose/70 text-sm font-semibold text-cream">Open full size</a>
          <button onClick={onClose} className="min-h-11 rounded-full bg-cream font-display text-[1.05rem] text-[#3a0817]">Close</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
