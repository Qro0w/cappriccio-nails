import { useCallback, useEffect, useState } from 'react'
import { supabase, publicUrl } from '../lib/supabase'
import { TIER_COUNT } from '../lib/config'
import Lightbox from './Lightbox'

// Loads tier photos (public table). Re-checks every 45s and when the tab regains focus,
// so photos the nailtech adds or removes show up without a redeploy.
export function useTierImages() {
  const [imgs, setImgs] = useState({})
  const load = useCallback(async () => {
    const { data } = await supabase.from('tier_images').select('tier,path,created_at').order('created_at')
    const m = {}
    ;(data || []).forEach((r) => (m[r.tier] ||= []).push(publicUrl('tier-photos', r.path)))
    setImgs(m)
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(load, 45000)
    const f = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', f)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', f) }
  }, [load])
  return imgs
}

export default function TierPicker({ value, onChange }) {
  const imgs = useTierImages()
  const [box, setBox] = useState(null) // { tier, i }
  return (
    <div className="space-y-3">
      {Array.from({ length: TIER_COUNT }, (_, k) => k + 1).map((n) => {
        const list = imgs[n] || []
        const on = Number(value) === n
        return (
          <div key={n} className={`rounded-2xl border p-3 ${on ? 'border-rose bg-rose/10' : 'border-cream/15'}`}>
            <button type="button" onClick={() => onChange(n)} className="flex min-h-11 w-full items-center justify-between text-left">
              <span className="text-base font-semibold">Tier {n}</span>
              <span className={`flex size-6 items-center justify-center rounded-full border text-xs ${on ? 'border-rose bg-rose text-ink' : 'border-cream/40'}`}>{on ? '✓' : ''}</span>
            </button>
            {list.length > 0 ? (
              <div className="-mx-1 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                {list.map((u, i) => (
                  <button key={u} type="button" onClick={() => setBox({ tier: n, i })} className="shrink-0 snap-start">
                    <img src={u} alt={`Tier ${n} example ${i + 1}`} loading="lazy" className="h-28 w-24 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-cream/50">Photos coming soon.</p>
            )}
            {list.length > 0 && <p className="mt-1 text-[11px] text-cream/50">Swipe to see more · tap a photo to enlarge</p>}
          </div>
        )
      })}
      <Lightbox images={box ? imgs[box.tier] || [] : []} index={box?.i ?? null}
        onIndex={(i) => setBox((b) => ({ ...b, i }))} onClose={() => setBox(null)} />
    </div>
  )
}
