import Select from './Select'
import { INTENSIVE_FEE, LENGTHS, REMOVALS, SERVICES, intensiveAllowed, removalOk, removalOptions } from '../lib/config'
import { peso } from '../lib/format'
import { Field } from './ui'

// Compact service editor used by the nailtech (add booking / edit booking).
// value = { service, length, removal, tier, intensive }
export default function ServiceFields({ value: v, onChange, errors = {} }) {
  const set = (patch) => onChange({ ...v, ...patch })
  const ext = SERVICES[v.service]?.ext
  const canIntensive = v.service && v.tier && v.removal && intensiveAllowed(v.service, v.tier, v.removal)
  return (
    <div className="space-y-3">
      <Field label="Service" error={errors.service}>
        <Select value={v.service} onChange={(x) => set({ service: x, length: '', removal: removalOk(x, v.removal) ? v.removal : '', intensive: false })}
          options={Object.entries(SERVICES).map(([k, s]) => ({ value: k, label: s.label }))} />
      </Field>
      {ext && (
        <Field label="Length" error={errors.length}>
          <div className="grid grid-cols-3 gap-2">
            {LENGTHS.map((l) => (
              <button key={l} type="button" onClick={() => set({ length: l })}
                className={`min-h-11 rounded-xl border capitalize ${v.length === l ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>{l}</button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Removal" error={errors.removal}>
        <Select value={v.removal} onChange={(x) => set({ removal: x, intensive: false })}
          options={(v.service ? removalOptions(v.service) : Object.keys(REMOVALS)).map((k) => ({ value: k, label: REMOVALS[k].label, extra: REMOVALS[k].fee ? `+${peso(REMOVALS[k].fee)}` : '' }))} />
      </Field>
      <Field label="Design tier" error={errors.tier}>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => set({ tier: n, intensive: false })}
              className={`min-h-11 rounded-xl border ${Number(v.tier) === n ? 'border-cream bg-cream text-ink' : 'border-cream/25'}`}>Tier {n}</button>
          ))}
        </div>
      </Field>
      {canIntensive && (
        <label className="flex items-center gap-3 rounded-2xl border border-cream/20 p-3 text-sm">
          <input type="checkbox" className="size-6 accent-rose" checked={!!v.intensive} onChange={(e) => set({ intensive: e.target.checked })} />
          Intensive Manicure (+{peso(INTENSIVE_FEE)})
        </label>
      )}
    </div>
  )
}

export function serviceErrors(v) {
  const e = {}
  if (!v.service) e.service = 'Choose a service.'
  if (SERVICES[v.service]?.ext && !v.length) e.length = 'Choose a length.'
  if (!v.removal) e.removal = 'Choose a removal option.'
  if (!v.tier) e.tier = 'Choose a tier.'
  return e
}
