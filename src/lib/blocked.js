import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { normPhone } from './clients'

// Blocked clients (nailtech only). A client is blocked if their phone number OR Instagram handle
// is on the list. The database enforces it too (supabase/20_blocklist.sql).
export const normIg = (v = '') => String(v).replace(/[@\s]/g, '').toLowerCase()

export function useBlocklist() {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('blocked_clients').select('*').order('created_at', { ascending: false })
    if (error) { setErr('Could not load the blocked list.'); setList([]); return }
    setErr(''); setList(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const findEntry = (phone, ig) => {
    const p = normPhone(phone), i = normIg(ig)
    return (list || []).find((b) => (b.phone && b.phone === p) || (b.instagram && b.instagram === i)) || null
  }
  async function block({ phone, instagram, name, reason }) {
    const row = { phone: normPhone(phone) || null, instagram: normIg(instagram) || null, name: name || null, reason: reason || null }
    if (!row.phone && !row.instagram) return 'Enter an Instagram handle or a phone number.'
    const { error } = await supabase.from('blocked_clients').insert(row)
    if (error) return 'Could not block. Please try again.'
    await load(); return ''
  }
  async function unblock(entry) {
    const { error } = await supabase.from('blocked_clients').delete().eq('id', entry.id)
    if (error) return 'Could not unblock. Please try again.'
    await load(); return ''
  }
  return { list, err, findEntry, block, unblock }
}
