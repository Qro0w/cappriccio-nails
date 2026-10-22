import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Admin pages remember where she was (tab, filter, search, month, day, scroll) for this
// browser session, so going into a booking and coming back lands her in the same spot.
const KEY = 'cpn-admin:'
const read = (k) => { try { const v = sessionStorage.getItem(KEY + k); return v == null ? undefined : JSON.parse(v) } catch { return undefined } }
const write = (k, v) => { try { sessionStorage.setItem(KEY + k, JSON.stringify(v)) } catch { /* private mode: just don't remember */ } }

// Like useState, but survives leaving the page. Dates are stored as ISO strings.
export function useRemembered(k, initial) {
  const [v, setV] = useState(() => {
    const saved = read(k)
    if (saved === undefined) return typeof initial === 'function' ? initial() : initial
    return saved && typeof saved === 'object' && saved.$date ? new Date(saved.$date) : saved
  })
  useEffect(() => { write(k, v instanceof Date ? { $date: v.toISOString() } : v) }, [k, v])
  return [v, setV]
}

// Puts the page back at the same scroll position once its content has loaded (ready = true).
export function useRememberedScroll(k, ready) {
  useLayoutEffect(() => {
    if (!ready) return undefined
    const y = read('scroll:' + k)
    if (y) window.scrollTo(0, y)
    const save = () => write('scroll:' + k, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => { save(); window.removeEventListener('scroll', save) }
  }, [k, ready])
}

// "← Back" that returns to wherever she actually came from; falls back to a page if opened directly.
export function useBack(fallback) {
  const nav = useNavigate()
  const loc = useLocation()
  return () => (loc.key !== 'default' && window.history.state?.idx > 0 ? nav(-1) : nav(fallback))
}
