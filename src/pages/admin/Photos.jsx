import { useCallback, useEffect, useState } from 'react'
import { supabase, publicUrl } from '../../lib/supabase'
import { compressImage } from '../../lib/image'
import { uid } from '../../lib/format'
import { TIER_COUNT } from '../../lib/config'
import { Card, ConfirmDialog, ErrorText } from '../../components/ui'

export default function Photos() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  const [del, setDel] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('tier_images').select('*').order('created_at')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function add(tier, files) {
    if (!files.length) return
    setBusy(tier); setErr('')
    for (const f of files) {
      const img = await compressImage(f)
      const path = `tier-${tier}/${uid()}.${img.ext}`
      const up = await supabase.storage.from('tier-photos').upload(path, img.blob, { contentType: img.type })
      if (up.error) { setErr('One photo failed to upload. Please try again.'); continue }
      const ins = await supabase.from('tier_images').insert({ tier, path })
      if (ins.error) { await supabase.storage.from('tier-photos').remove([path]); setErr('Could not save a photo.') }
    }
    setBusy(null); load()
  }
  async function remove() {
    const r = del; setDel(null)
    await supabase.storage.from('tier-photos').remove([r.path])
    const { error } = await supabase.from('tier_images').delete().eq('id', r.id)
    if (error) setErr('Could not remove that photo.')
    load()
  }

  if (!rows) return <p className="text-center text-cream/60">Loading…</p>
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Tier photos</h1>
      <p className="text-sm text-cream/70">Add as many reference photos as you like for each tier. Clients see changes right away, no redeploy needed.</p>
      <ErrorText>{err}</ErrorText>
      {Array.from({ length: TIER_COUNT }, (_, k) => k + 1).map((n) => {
        const list = rows.filter((r) => r.tier === n)
        return (
          <Card key={n} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-peach">Tier {n}</h2>
              <span className="text-xs text-cream/60">{list.length} photo{list.length === 1 ? '' : 's'}</span>
            </div>
            {list.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {list.map((r) => (
                  <div key={r.id} className="relative">
                    <img src={publicUrl('tier-photos', r.path)} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-xl object-cover" />
                    <button aria-label="Remove photo" onClick={() => setDel(r)} className="absolute right-1 top-1 size-9 rounded-full bg-black/70 text-lg">✕</button>
                  </div>
                ))}
              </div>
            )}
            <label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-rose/60 font-semibold text-rose ${busy === n ? 'opacity-50' : ''}`}>
              {busy === n ? 'Uploading…' : '+ Add photos'}
              <input type="file" accept="image/*" multiple className="hidden" disabled={busy === n}
                onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; add(n, f) }} />
            </label>
          </Card>
        )
      })}
      <ConfirmDialog open={!!del} danger title="Remove this photo?" body="It disappears from the client booking page." confirmLabel="Remove" onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  )
}
