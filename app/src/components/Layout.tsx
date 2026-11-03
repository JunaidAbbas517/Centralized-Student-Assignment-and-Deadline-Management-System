import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { btnGhost } from './ui'

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-indigo-100 font-semibold text-indigo-800' : 'hover:bg-slate-100'}`

export default function Layout() {
  const { profile, session } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
      if (!cancelled) setUnread(count ?? 0)
    }
    void load()
    const timer = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [session])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2">
          <span className="mr-4 font-bold text-indigo-700">Deadline Manager</span>
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/courses" className={link}>Courses</NavLink>
          <NavLink to="/calendar" className={link}>Calendar</NavLink>
          {profile?.role === 'student' && (
            <NavLink to="/notifications" className={link}>
              Notifications
              {unread > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}
            </NavLink>
          )}
          <span className="ml-auto text-sm text-slate-600">
            {profile?.full_name || profile?.email} ({profile?.role})
          </span>
          <button className={btnGhost} onClick={() => supabase.auth.signOut()}>Log out</button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
