import { useEffect, useState } from 'react'
import { supabase, publicUrl } from './supabase'
import { POLICIES, POLICY_VERSION } from './content'

// Public settings (GCash, QR, policies…) loaded once per visit and shared by every page.
let cache = null
let inflight = null
export function loadPublicSettings(force = false) {
  if (cache && !force) return Promise.resolve(cache)
  if (!inflight || force) {
    inflight = supabase.rpc('get_public_settings').then(({ data }) => {
      cache = data || {}
      inflight = null
      return cache
    })
  }
  return inflight
}

export function usePublicSettings() {
  const [cfg, setCfg] = useState(cache)
  useEffect(() => {
    let alive = true
    loadPublicSettings().then((c) => alive && setCfg(c)).catch(() => alive && setCfg({}))
    return () => { alive = false }
  }, [])
  return cfg // null while loading
}

// Policies: the nailtech's edited copy if there is one, otherwise the original text from the doc.
export function policiesFrom(cfg) {
  try {
    const p = cfg?.policies_json ? JSON.parse(cfg.policies_json) : null
    if (Array.isArray(p) && p.length) return p
  } catch { /* fall back */ }
  return POLICIES
}
export const policyVersionFrom = (cfg) => (cfg?.policy_version ? cfg.policy_version : POLICY_VERSION)

// The reschedule / cancel lines shown on a client's booking page come from the policies too.
export function changeLinesFrom(policies) {
  const lines = []
  policies.forEach((g) => g.items.forEach((it) => {
    const t = typeof it === 'string' ? it : it.text
    if (/reschedul|cancel/i.test(t)) lines.push(t)
  }))
  return lines
}

export const qrUrlFrom = (cfg) => (cfg?.gcash_qr_path ? publicUrl('tier-photos', cfg.gcash_qr_path) : '/gcash-qr.png')
