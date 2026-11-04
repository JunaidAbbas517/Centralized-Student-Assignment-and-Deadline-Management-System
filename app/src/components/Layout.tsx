import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell, BookOpen, CalendarDays, FileText, History, LayoutGrid, LogOut, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { BrandMark, label, registerCourses } from './ui'

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
  return name.split(/\s+/).filter((p) => p && !p.endsWith('.')).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

/** The fixed background environment: two slow glows and a whisper of grain. */
export function Environment() {
  useEffect(() => {
    const onVis = () => document.body.classList.toggle('paused', document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return (
    <div className="env" aria-hidden="true">
      <div className="env-grain" />
    </div>
  )
}

export default function Layout() {
  const { profile, session } = useAuth()
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const [courseCount, setCourseCount] = useState(0)
  // Course colours are fixed here, before any page renders, so they match everywhere.
  const [ready, setReady] = useState(false)
  const isStudent = profile?.role === 'student'

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const load = async () => {
      const n = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
      const c = await supabase.from('courses').select('id, course_code')
      if (cancelled) return
      setUnread(n.count ?? 0)
      const list = (c.data ?? []) as { id: string; course_code: string }[]
      registerCourses([...list].sort((x, y) => x.course_code.localeCompare(y.course_code)).map((x) => x.id))
      setCourseCount(list.length)
      setReady(true)
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

  return (
    <div className="min-h-screen text-slate-900 md:flex">
      <Environment />
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/55 px-4 py-5 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div>
            <div className="font-display text-[17px] font-semibold leading-tight tracking-tight">DeadlineHub</div>
            <div className="text-xs text-slate-500">{roleLabel} workspace</div>
          </div>
        </div>

        <p className={`${label} mt-9 mb-2 px-3`}>Workspace</p>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(25,25,39,.06),0_4px_12px_-6px_rgba(25,25,39,.12)] ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-600 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <item.icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  {item.label}
                  {item.to === '/notifications' && unread > 0 && (
                    <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 font-mono text-[10px] font-medium text-white">{unread}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-[13px] font-semibold text-indigo-800">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-slate-500">
              {roleLabel} · {courseCount} {courseCount === 1 ? 'course' : 'courses'}
            </div>
          </div>
          <button
            aria-label="Log out"
            title="Log out"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3">
          <BrandMark size={30} />
          <span className="font-display font-semibold tracking-tight">DeadlineHub</span>
          <button aria-label="Log out" className="tap ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => supabase.auth.signOut()}>
            <LogOut size={18} />
          </button>
        </div>
        <nav className="scroll-thin flex gap-1 overflow-x-auto px-3 py-2" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `tap flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
              {item.to === '/notifications' && unread > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 font-mono text-[10px] text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-7 outline-none md:px-10 md:py-9">
        {/* Re-key on route so each page plays its entrance. */}
        <div key={pathname} className="mx-auto max-w-[76rem]">
          {ready ? <Outlet /> : null}
        </div>
      </main>
    </div>
  )
}
