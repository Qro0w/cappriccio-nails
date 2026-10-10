import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CornerWaves, Logo } from '../../components/Decor'

export default function AdminLayout() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <p className="p-8 text-center text-cream/60">Loading…</p>
  if (!session) return <Navigate to="/admin/login" replace />

  const tab = ({ isActive }) => `flex min-h-14 flex-1 items-center justify-center text-xs font-semibold ${isActive ? 'text-cream' : 'text-cream/55'}`
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
    <CornerWaves />
    <div className="relative mx-auto max-w-2xl px-4 pb-28 pt-5">
      <header className="relative mb-4 flex justify-center">
        <div className="logo-glow pointer-events-none absolute -top-16 h-52 w-80 rounded-full" />
        <span className="relative"><Logo /></span>
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          <NavLink to="/admin" end className={tab}>📋 Bookings</NavLink>
          <NavLink to="/admin/schedule" className={tab}>🗓 Schedule</NavLink>
          <NavLink to="/admin/photos" className={tab}>🖼 Photos</NavLink>
          <NavLink to="/admin/settings" className={tab}>⚙️ Settings</NavLink>
          <button onClick={() => supabase.auth.signOut()} className="flex min-h-14 flex-1 items-center justify-center text-xs text-cream/60">Sign out</button>
        </div>
      </nav>
    </div>
    </div>
  )
}
