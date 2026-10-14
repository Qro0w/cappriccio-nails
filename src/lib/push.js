import { supabase } from './supabase'

// Public half of the push key pair (the private half lives only in Supabase secrets).
export const VAPID_PUBLIC_KEY = 'BORl9ARVSTB6FhnjTIpjmFieKbCmALty3JP7J63je3VYOrYUTiJtXxW-vjrtyrIsUXtIg2rXWF2PR37LII1xzHA'

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register('/sw.js') } catch { return null }
}

// 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-home-screen'
export async function pushStatus() {
  if (isIOS() && !isStandalone()) return 'needs-home-screen'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

const deviceName = () => {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows computer'
  return 'This device'
}

export async function turnOnPush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'blocked' : 'dismissed')
  const reg = (await registerSW()) || (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceName() })
  if (error) throw new Error('save')
}

export async function turnOffPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'notify_secret').maybeSingle()
  if (!data?.value) throw new Error('setup')
  const { data: res, error } = await supabase.functions.invoke('notify', {
    headers: { 'x-notify-secret': data.value },
    body: { title: 'Test notification ✿', body: 'Notifications are working on this device.', url: '/admin' },
  })
  if (error) throw new Error('function')
  return res
}

// Admin pages only: lets the nailtech "Add to Home Screen" as an app that opens straight to /admin
// (clients never get this manifest, so their home-screen shortcut would still open the booking site).
export function setupAdminApp() {
  if (typeof document === 'undefined') return
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/admin.webmanifest'
    document.head.appendChild(l)
  }
  registerSW()
}
