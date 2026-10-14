// Supabase Edge Function "notify": sends a phone notification to every device
// the nailtech turned notifications on for. Called by the database (13_push_notifications.sql)
// and by the "Send a test notification" button in admin Settings.
//
// Secrets to set in Supabase → Edge Functions → Secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-notify-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Only the database (and the logged-in nailtech, who can read this value) know the secret
    const { data: secret } = await db.from('settings').select('value').eq('key', 'notify_secret').single()
    if (!secret?.value || req.headers.get('x-notify-secret') !== secret.value) return reply(401, { error: 'not allowed' })

    const { title, body, url } = await req.json()
    if (!Deno.env.get('VAPID_PUBLIC_KEY') || !Deno.env.get('VAPID_PRIVATE_KEY')) return reply(500, { error: 'VAPID secrets are missing in Supabase → Edge Functions → Secrets' })
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@cappriccio.nails',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const { data: subs } = await db.from('push_subscriptions').select('endpoint,p256dh,auth')
    const payload = JSON.stringify({ title: title || 'Cappriccio Nails', body: body || '', url: url || '/admin' })
    let sent = 0
    const gone: string[] = []
    const errors: string[] = []
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) gone.push(s.endpoint) // device turned it off / app removed
        else errors.push(`${code ?? ''} ${(e as { body?: string }).body || (e as Error).message || e}`.trim())
      }
    }))
    if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
    return reply(200, { devices: (subs || []).length, sent, removed: gone.length, errors: errors.slice(0, 3) })
  } catch (e) {
    return reply(500, { error: String(e) })
  }
})
