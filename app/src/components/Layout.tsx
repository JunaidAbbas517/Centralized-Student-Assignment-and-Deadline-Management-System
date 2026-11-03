import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell, BookOpen, CalendarCheck, CalendarDays, FileText, History, LayoutGrid, LogOut, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean; studentOnly?: boolean }

const ITEMS: Item[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/assignments', label: 'Assignments', icon: FileText },
  { to: '/notifications', label: 'Notifications', icon: Bell, studentOnly: true },
  { to: '/history', label: 'Deadline history', icon: History },
]

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

export default function Layout() {
  const { profile, session } = useAuth()
  const [unread, setUnread] = useState(0)
  const [courseCount, setCourseCount] = useState(0)
  const isStudent = profile?.role === 'student'

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const load = async () => {
      const n = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
      const c = await supabase.from('courses').select('id', { count: 'exact', head: true })
      if (cancelled) return
      setUnread(n.count ?? 0)
      setCourseCount(c.count ?? 0)
    }
    void load()
    const timer = setInterval(load, 30000)
    window.addEventListener('notifications-changed', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('notifications-changed', load)
    }
  }, [session])

  const items = ITEMS.filter((i) => !i.studentOnly || isStudent)
  const name = profile?.full_name || profile?.email || ''
  const roleLabel = isStudent ? 'Student' : 'Instructor'

  const badge = (item: Item) =>
    item.to === '/notifications' && unread > 0 ? (
      <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>
    ) : null

  return (
    <div className="min-h-screen text-slate-900 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CalendarCheck size={20} />
          </div>
          <div>
            <div className="font-bold leading-tight">DeadlineHub</div>
            <div className="text-xs text-slate-500">{roleLabel} workspace</div>
          </div>
        </div>
        <nav className="mt-3 flex flex-col gap-1" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
              {badge(item)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-slate-200 p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-slate-500">{roleLabel} · {courseCount} {courseCount === 1 ? 'course' : 'courses'}</div>
          </div>
          <button
            aria-label="Log out"
            title="Log out"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CalendarCheck size={18} />
          </div>
          <span className="font-bold">DeadlineHub</span>
          <button
            aria-label="Log out"
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
              {item.to === '/notifications' && unread > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
