import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { setupAdminApp } from '../../lib/push'
import { CornerWaves, Logo } from '../../components/Decor'
import { Skeleton } from '../../components/Feedback'

export default function AdminLayout() {
  const [session, setSession] = useState(undefined)
  const [askOut, setAskOut] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setupAdminApp() }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="mx-auto max-w-2xl p-6"><Skeleton lines={4} /></div>
  if (!session) return <Navigate to="/admin/login" replace />

  const tab = ({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${isActive ? 'text-cream' : 'text-cream/55'}`
  const ic = 'text-base leading-none'
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
    <CornerWaves />
    <div className="relative mx-auto max-w-2xl px-4 pb-28 pt-5 lg:max-w-5xl">
      <header className="relative mb-4 flex justify-center">
        <div className="logo-glow pointer-events-none absolute -top-16 h-52 w-80 rounded-full" />
        <span className="relative"><Logo /></span>
      </header>
      <div key={pathname} className="page-in"><Outlet /></div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl lg:max-w-5xl">
          <NavLink to="/admin" end className={tab}><span className={ic}>📋</span>Bookings</NavLink>
          <NavLink to="/admin/schedule" className={tab}><span className={ic}>🗓</span>Schedule</NavLink>
          <NavLink to="/admin/earnings" className={tab}><span className={ic}>₱</span>Earnings</NavLink>
          <NavLink to="/admin/photos" className={tab}><span className={ic}>🖼</span>Photos</NavLink>
          <NavLink to="/admin/settings" className={tab}><span className={ic}>⚙️</span>Settings</NavLink>
          <NavLink to="/admin/bebi" className={tab}><span className={ic}>♡</span>Bebi</NavLink>
          <button onClick={() => setAskOut(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-cream/60"><span className={ic}>↩</span>Sign out</button>
        </div>
      </nav>
      <ConfirmDialog open={askOut} title="Sign out?" busy={leaving} confirmLabel="Sign out"
        body="You’ll need your email and password to get back in on this device."
        onConfirm={async () => { setLeaving(true); await supabase.auth.signOut(); setLeaving(false); setAskOut(false) }}
        onCancel={() => setAskOut(false)} />
    </div>
    </div>
  )
}
