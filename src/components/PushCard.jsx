import { useEffect, useState } from 'react'
import { isIOS, pushStatus, sendTestPush, turnOffPush, turnOnPush } from '../lib/push'
import { Btn, Card } from './ui'

// Settings card: turn phone notifications on/off for THIS device, and send a test.
export default function PushCard() {
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  const refresh = () => pushStatus().then(setSt).catch(() => setSt('unsupported'))
  useEffect(() => { refresh() }, [])

  const say = (m, isBad = false) => { setMsg(m); setBad(isBad) }
  async function on() {
    setBusy(true); say('')
    try { await turnOnPush(); say('Notifications are on for this device ✓') }
    catch (e) {
      say(e.message === 'blocked' ? 'Notifications are blocked for this site. Allow them in your phone’s settings, then try again.'
        : e.message === 'dismissed' ? 'You didn’t allow notifications. Tap the button again and choose “Allow”.'
          : e.message === 'save' ? 'Couldn’t save this device. Make sure 13_push_notifications.sql has been run, then try again.'
            : 'Couldn’t turn notifications on. Please try again.', true)
    }
    setBusy(false); refresh()
  }
  async function off() {
    setBusy(true); say('')
    try { await turnOffPush(); say('Notifications turned off for this device.') } catch { say('Couldn’t turn them off. Please try again.', true) }
    setBusy(false); refresh()
  }
  async function test() {
    setBusy(true); say('')
    try {
      const r = await sendTestPush()
      if (r?.sent) say(`Test sent to ${r.sent} device${r.sent === 1 ? '' : 's'} ✓ It should pop up in a few seconds.`)
      else if (r?.errors?.length) say('The notification service refused it: ' + r.errors[0], true)
      else say('No devices to send to yet. Tap “Turn off here”, then turn notifications on again.', true)
    } catch (e) {
      if (e.message?.startsWith('detail:')) { say(e.message.slice(7), true); setBusy(false); return }
      say(e.message === 'setup' ? 'Notifications aren’t set up on the server yet (run 13_push_notifications.sql).' : 'The test couldn’t be sent. Check the “notify” function and its secrets in Supabase.', true)
    }
    setBusy(false)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Phone notifications</h2>
          <p className="text-xs text-cream/60">Get a notification for new bookings, receipts to check, and cancellations.</p>
        </div>
        {st === 'on' && <span className="shrink-0 rounded-full bg-rose/15 px-2.5 py-0.5 text-xs font-semibold text-rose">On</span>}
      </div>

      {st === null && <p className="text-sm text-cream/60">Checking this device…</p>}

      {st === 'needs-home-screen' && (
        <div className="space-y-2 rounded-2xl border border-cream/15 bg-ink/40 p-3 text-sm">
          <p className="font-semibold">On iPhone, add this site to your Home Screen first:</p>
          <ol className="list-decimal space-y-1 pl-5 text-cream/85">
            <li>In Safari, tap the <b>Share</b> button (square with an arrow).</li>
            <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            <li>Open <b>Cappriccio</b> from your Home Screen, log in, and come back here.</li>
          </ol>
          <p className="text-xs text-cream/60">Needs iOS 16.4 or newer.</p>
        </div>
      )}
      {st === 'unsupported' && <p className="text-sm text-cream/70">This browser can’t receive notifications.{isIOS() ? ' Update your iPhone to iOS 16.4 or newer.' : ' Try Chrome on your phone.'}</p>}
      {st === 'blocked' && <p className="text-sm text-cream/70">Notifications are blocked for this site. Allow them in your phone’s settings (Settings → Notifications), then reopen this page.</p>}

      {st === 'off' && <Btn className="w-full" disabled={busy} onClick={on}>🔔 Turn on notifications on this device</Btn>}
      {st === 'on' && (
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ghost" className="!min-h-11 text-sm" disabled={busy} onClick={test}>Send a test</Btn>
          <Btn variant="ghost" className="!min-h-11 text-sm" disabled={busy} onClick={off}>Turn off here</Btn>
        </div>
      )}
      {msg && <p className={`text-center text-sm ${bad ? 'text-red-200' : 'text-emerald-200'}`}>{msg}</p>}
      <p className="text-xs text-cream/50">Turn it on separately on each phone or computer you want alerts on.</p>
    </Card>
  )
}
