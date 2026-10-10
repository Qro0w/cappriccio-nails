// Tiny formatter for emphasis:  **bold** (gold)   !!warning!! (red)   //italic//   __underline__
const TOKENS = [['**', 'strong'], ['!!', 'warn'], ['//', 'em'], ['__', 'u']]

import { IG_HANDLE, IG_URL } from '../lib/config'
import { IgIcon } from './Icons'

// any mention of her handle becomes a tappable link to her Instagram
function linkHandle(text, depth) {
  if (typeof text !== 'string' || !text.includes(IG_HANDLE)) return text
  return text.split(IG_HANDLE).flatMap((part, i) => i === 0 ? [part] : [
    <a key={`ig-${depth}-${i}`} href={IG_URL} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-rose underline decoration-rose/40 underline-offset-2">
      <IgIcon />{IG_HANDLE}
    </a>, part])
}

const Warn = ({ children }) => <strong className="rounded bg-red-500/25 px-1 font-bold text-red-200">{children}</strong>

function parse(text, depth = 0) {
  let best = null
  for (const [tok, tag] of TOKENS) {
    const i = text.indexOf(tok)
    if (i >= 0 && text.indexOf(tok, i + 2) > i && (!best || i < best.i)) best = { i, tok, tag }
  }
  if (!best) return linkHandle(text, depth)
  const end = text.indexOf(best.tok, best.i + 2)
  const Tag = best.tag === 'warn' ? Warn : best.tag
  return [
    linkHandle(text.slice(0, best.i), depth + 0.5),
    <Tag key={`${depth}-${best.i}`}>{parse(text.slice(best.i + 2, end), depth + 1)}</Tag>,
    parse(text.slice(end + 2), depth + 1),
  ]
}

export default function Rich({ text }) {
  return <>{parse(text)}</>
}

// A bullet list that supports one level of sub-bullets: items are strings or { text, sub: [...] }
export function RichList({ items, className = '' }) {
  return (
    <ul className={`list-disc space-y-2 pl-5 text-[13px] leading-snug text-cream/80 [&_strong]:font-bold [&_strong]:text-peach ${className}`}>
      {items.map((it, n) =>
        typeof it === 'string' ? (
          <li key={n}><Rich text={it} /></li>
        ) : (
          <li key={n}>
            <Rich text={it.text} />
            <ul className="mt-1.5 list-[circle] space-y-1 pl-4">
              {it.sub.map((s, k) => <li key={k}><Rich text={s} /></li>)}
            </ul>
          </li>
        )
      )}
    </ul>
  )
}
