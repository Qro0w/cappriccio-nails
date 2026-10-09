// Tiny formatter for the doc's emphasis:  **bold**   //italic//   __underline__
const TOKENS = [['**', 'strong'], ['//', 'em'], ['__', 'u']]

function parse(text, depth = 0) {
  let best = null
  for (const [tok, tag] of TOKENS) {
    const i = text.indexOf(tok)
    if (i >= 0 && text.indexOf(tok, i + 2) > i && (!best || i < best.i)) best = { i, tok, tag }
  }
  if (!best) return text
  const end = text.indexOf(best.tok, best.i + 2)
  const Tag = best.tag
  return [
    text.slice(0, best.i),
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
    <ul className={`list-disc space-y-2 pl-5 text-[13px] leading-snug text-cream/80 [&_strong]:font-bold [&_strong]:text-cream ${className}`}>
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
