import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const Chevron = ({ open, className = '' }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true"
    className={`size-4 shrink-0 transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''} ${className}`}>
    <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Themed dropdown that replaces the browser's grey <select> list.
// options: [{ value, label, extra?, group? }]  (extra = small text on the right, e.g. a fee)
export default function Select({ value, onChange, options, placeholder = 'Choose…' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [active, setActive] = useState(-1)
  const btn = useRef(null)
  const list = useRef(null)
  const current = options.find((o) => String(o.value) === String(value))

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < 260 && r.top > below
    setPos({ left: r.left, width: r.width, top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, max: Math.max(160, (up ? r.top : below) - 16) })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    const out = (e) => { if (!btn.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', out)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', out); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', close) }
  }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const choose = (o) => { onChange(o.value); setOpen(false); btn.current?.focus() }
  const toggle = () => { setActive(Math.max(0, options.indexOf(current))); setOpen((v) => !v) }
  const onKey = (e) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(); return }
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]) }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <>
      <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={(e) => { e.preventDefault(); toggle() }} onKeyDown={onKey}
        className={`sel flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-ink/50 px-4 text-left text-base transition-colors focus:border-rose focus:outline-none ${open ? 'border-rose' : 'border-cream/20'}`}>
        <span className={`min-w-0 truncate ${current ? 'text-cream' : 'text-cream/45'}`}>
          {current ? current.label : placeholder}
          {current?.extra && <span className="ml-2 text-sm text-rose">{current.extra}</span>}
        </span>
        <Chevron open={open} className="text-cream/60" />
      </button>
      {open && pos && createPortal(
        <div ref={list} role="listbox" onClick={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}
          className="sel-pop z-[60] overflow-y-auto overscroll-contain rounded-2xl border border-cream/15 bg-[#1a050b] p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md">
          {options.map((o, i) => {
            const head = o.group && o.group !== options[i - 1]?.group
            const sel = String(o.value) === String(value)
            return (
              <div key={o.value}>
                {head && <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-peach/70">{o.group}</div>}
                <button type="button" role="option" aria-selected={sel} data-active={i === active}
                  onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[0.92rem] leading-snug transition-colors ${i === active ? 'bg-cream/[0.08]' : ''} ${sel ? 'text-cream' : 'text-cream/85'}`}>
                  <span className="flex-1">{o.label}</span>
                  {o.extra && <span className="text-sm text-rose/90">{o.extra}</span>}
                  <span className={`w-4 text-center text-rose ${sel ? '' : 'invisible'}`}>✓</span>
                </button>
              </div>
            )
          })}
        </div>, document.body)}
    </>
  )
}
