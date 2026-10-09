import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLayout() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <p className="p-8 text-center text-cream/60">Loading…</p>
  if (!session) return <Navigate to="/admin/login" replace />

  const tab = ({ isActive }) => `flex min-h-14 flex-1 items-center justify-center text-sm font-semibold ${isActive ? 'text-rose' : 'text-cream/60'}`
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-4">
      <header className="mb-4 text-center font-display text-2xl font-bold">Cappriccio <span className="text-rose">Nails</span> <span className="text-sm font-normal text-cream/50">· admin</span></header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          <NavLink to="/admin" end className={tab}>📋 Bookings</NavLink>
          <NavLink to="/admin/schedule" className={tab}>🗓 Schedule</NavLink>
          <NavLink to="/admin/settings" className={tab}>⚙️ Settings</NavLink>
          <button onClick={() => supabase.auth.signOut()} className="flex min-h-14 flex-1 items-center justify-center text-sm text-cream/60">Sign out</button>
        </div>
      </nav>
    </div>
  )
}
