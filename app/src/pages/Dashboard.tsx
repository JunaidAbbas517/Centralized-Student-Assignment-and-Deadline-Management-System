import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bell, CheckCircle2, Clock, History, Plus, RefreshCw, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import { btn, btnGhost, Card, CourseDot, courseTheme, ErrorText, firstName, PageHeader, Segmented } from '../components/ui'
import {
  daysFromToday, formatDay, formatLongDate, formatShort, greeting, isOverdue, relativeLabel, weekDays,
  dayKey, whenLabel, whenPhrase,
} from '../lib/dates'
import { notifyNotificationsChanged, saveProgress } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Course, Notification } from '../lib/types'
import { useAssignments } from '../lib/useAssignments'

export default function Dashboard() {
  const { profile } = useAuth()
  if (!profile) return null
  return profile.role === 'student' ? <StudentDashboard /> : <InstructorDashboard />
}

const searchBox = (value: string, onChange: (v: string) => void) => (
  <label className="relative hidden sm:block">
    <span className="sr-only">Search assignments</span>
    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search assignments"
      className="w-64 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
    />
  </label>
)

function StatCard({ icon, label, value, sub, tone = 'text-slate-500' }: {
  icon: React.ReactNode; label: string; value: number; sub: string; tone?: string
}) {
  return (
    <Card className="!p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>{icon}{label}</div>
      <div className={`mt-2 text-3xl font-bold ${tone === 'text-red-700' ? 'text-red-700' : ''}`}>{value}</div>
      <div className="mt-1 truncate text-sm text-slate-500">{sub}</div>
    </Card>
  )
}

function WeekStrip({ assignments }: { assignments: { id: string; course_id: string; current_deadline: string }[] }) {
  const days = weekDays()
  const today = dayKey(new Date())
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">This week</h2>
        <Link to="/calendar" className="text-sm font-semibold text-indigo-700 hover:underline">Open calendar</Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d) => {
          const key = dayKey(d)
          const isToday = key === today
          const dots = assignments.filter((a) => dayKey(new Date(a.current_deadline)) === key).slice(0, 3)
          return (
            <div
              key={key}
              className={`rounded-xl py-2 ${isToday ? 'bg-indigo-600 text-white' : ''}`}
              aria-label={`${d.toDateString()}${dots.length ? `, ${dots.length} deadline${dots.length > 1 ? 's' : ''}` : ''}`}
            >
              <div className={`text-[10px] font-semibold uppercase ${isToday ? 'text-indigo-100' : 'text-slate-500'}`}>
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </div>
              <div className="text-lg font-semibold">{d.getDate()}</div>
              <div className="mt-1 flex h-2 justify-center gap-0.5">
                {dots.map((a) => (
                  <span key={a.id} className="h-1.5 w-1.5 rounded-full" style={{ background: courseTheme(a.course_id).dot }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------- Student ----------------

type NotifRow = Notification & { assignments: { title: string; course_id: string; courses: { name: string } | null } | null }

function StudentDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { assignments, progress, changed, people, loading, error, reload } = useAssignments('student')
  const [tab, setTab] = useState<'all' | 'week' | 'overdue'>('all')
  const [query, setQuery] = useState('')
  const [notifs, setNotifs] = useState<NotifRow[]>([])

  const loadNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, assignments(title, course_id, courses(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs((data ?? []) as unknown as NotifRow[])
  }, [])

  useEffect(() => {
    void loadNotifs()
  }, [loadNotifs])

  const statusOf = (id: string) => progress[id] ?? 'pending'
  const open = useMemo(() => assignments.filter((a) => statusOf(a.id) !== 'completed'), [assignments, progress])
  const overdue = open.filter((a) => isOverdue(a.current_deadline))
  const upcoming = open.filter((a) => !isOverdue(a.current_deadline) && daysFromToday(a.current_deadline) <= 14)
  const inProgress = assignments.filter((a) => statusOf(a.id) === 'in_progress')
  const completed = assignments.filter((a) => statusOf(a.id) === 'completed')

  const rows = open
    .filter((a) => {
      if (tab === 'overdue') return isOverdue(a.current_deadline)
      if (tab === 'week') return !isOverdue(a.current_deadline) && daysFromToday(a.current_deadline) <= 7
      return true
    })
    .filter((a) => `${a.title} ${a.courses?.name}`.toLowerCase().includes(query.toLowerCase()))

  const unread = notifs.filter((n) => !n.is_read)
  const banner = unread.find((n) => n.type === 'deadline_changed' && n.assignment_id && changed[n.assignment_id])
  const bannerAssignment = banner && assignments.find((a) => a.id === banner.assignment_id)
  const bannerChange = banner?.assignment_id ? changed[banner.assignment_id] : undefined

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    await loadNotifs()
    notifyNotificationsChanged()
  }

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; total: number; done: number }>()
    for (const a of assignments) {
      const c = map.get(a.course_id) ?? { id: a.course_id, name: a.courses?.name ?? '', code: a.courses?.course_code ?? '', total: 0, done: 0 }
      c.total++
      if (statusOf(a.id) === 'completed') c.done++
      map.set(a.course_id, c)
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [assignments, progress])

  if (loading) return <p>Loading…</p>
  const nextDue = upcoming[0]
  const firstOverdue = overdue[0]

  return (
    <div>
      <PageHeader eyebrow={formatLongDate()} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`}>
        {searchBox(query, setQuery)}
        <button
          aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
          className="relative rounded-xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50"
          onClick={() => navigate('/notifications')}
        >
          <Bell size={18} />
          {unread.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />}
        </button>
        <Link to="/courses" className={btn}><Plus size={16} /> Enroll in a course</Link>
      </PageHeader>
      <ErrorText message={error} />

      {banner && bannerAssignment && bannerChange && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <RefreshCw size={18} />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">Deadline changed in {bannerAssignment.courses?.name}</div>
            <div>
              {bannerAssignment.title} moved from <s>{formatShort(bannerChange.previous_deadline)}</s> to{' '}
              <strong>{formatShort(bannerChange.new_deadline)}</strong>. Changed by{' '}
              {people[bannerChange.changed_by] ?? 'your instructor'} {whenPhrase(bannerChange.changed_at)}.
            </div>
          </div>
          <Link to={`/assignments/${bannerAssignment.id}`} className={btnGhost}>View history</Link>
          <button className="px-2 text-sm font-semibold text-orange-800 hover:underline" onClick={() => void markRead(banner.id)}>
            Mark as read
          </button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Clock size={14} />} label="Upcoming · 14 days" value={upcoming.length}
          sub={nextDue ? `Next due ${formatShort(nextDue.current_deadline)}` : 'Nothing due soon'} />
        <StatCard icon={<Clock size={14} />} label="In progress" value={inProgress.length}
          sub={`Across ${new Set(inProgress.map((a) => a.course_id)).size} courses`} />
        <StatCard icon={<CheckCircle2 size={14} />} label="Completed" value={completed.length}
          sub={`Of ${assignments.length} assignments`} />
        <StatCard icon={<AlertCircle size={14} />} label="Overdue" value={overdue.length} tone="text-red-700"
          sub={firstOverdue ? `${firstOverdue.title.split(':')[0]} · ${relativeLabel(firstOverdue.current_deadline).text.replace('overdue', 'past deadline')}` : 'You are all caught up'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="!p-0 self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h2 className="text-lg font-bold">Upcoming assignments</h2>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[{ value: 'all', label: 'All' }, { value: 'week', label: 'This week' }, { value: 'overdue', label: 'Overdue' }]}
            />
          </div>
          <AssignmentTable
            rows={tab === 'all' && !query ? rows.slice(0, 5) : rows}
            progress={progress}
            changed={changed}
            role="student"
            empty="No assignments match."
            onStatus={async (a, s) => {
              if (!profile) return
              await saveProgress(profile.id, a.id, s)
              await reload()
            }}
          />
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/assignments" className="text-sm font-semibold text-indigo-700 hover:underline">View all assignments</Link>
          </div>
        </Card>

        <div className="space-y-5">
          <WeekStrip assignments={assignments} />
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-bold">My courses</h2>
              <span className="text-xs text-slate-500">Your progress</span>
            </div>
            <ul className="space-y-3">
              {courses.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CourseDot courseId={c.id} /> <span className="truncate">{c.name}</span>
                    <span className="ml-auto text-slate-500">{c.done} of {c.total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={c.done} aria-valuemax={c.total} aria-label={`${c.name} progress`}>
                    <div className="h-full rounded-full" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%`, background: courseTheme(c.id).dot }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Recent notifications</h2>
            {notifs.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ul className="space-y-4">
                {notifs.slice(0, 3).map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: n.is_read || !n.assignments ? '#cbd5e1' : courseTheme(n.assignments.course_id).dot }}
                    />
                    <div className="min-w-0 text-sm">
                      <div className="font-semibold">{n.message}</div>
                      <div className="text-xs text-slate-500">
                        {n.assignments?.courses?.name} · {whenLabel(n.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------- Instructor ----------------

interface RecentChange {
  id: string
  previous_deadline: string
  new_deadline: string
  changed_at: string
  assignments: { title: string; course_id: string; courses: { name: string } | null } | null
}

function InstructorDashboard() {
  const { profile } = useAuth()
  const { assignments, changed, loading, error } = useAssignments('instructor')
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolled, setEnrolled] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<RecentChange[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    void (async () => {
      const c = await supabase.from('courses').select('*').eq('archived', false)
      setCourses((c.data ?? []) as Course[])
      const e = await supabase.from('enrollments').select('course_id')
      const counts: Record<string, number> = {}
      for (const r of (e.data ?? []) as { course_id: string }[]) counts[r.course_id] = (counts[r.course_id] ?? 0) + 1
      setEnrolled(counts)
      const r = await supabase
        .from('deadline_changes')
        .select('id, previous_deadline, new_deadline, changed_at, assignments(title, course_id, courses(name))')
        .order('changed_at', { ascending: false })
        .limit(5)
      setRecent((r.data ?? []) as unknown as RecentChange[])
    })()
  }, [])

  if (loading) return <p>Loading…</p>
  const upcoming = assignments.filter((a) => !isOverdue(a.current_deadline))
  const within14 = upcoming.filter((a) => daysFromToday(a.current_deadline) <= 14)
  const rows = upcoming.filter((a) => `${a.title} ${a.courses?.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  const studentsTotal = Object.values(enrolled).reduce((x, y) => x + y, 0)

  return (
    <div>
      <PageHeader eyebrow={formatLongDate()} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`}>
        {searchBox(query, setQuery)}
        <Link to="/courses" className={btn}><Plus size={16} /> New course</Link>
      </PageHeader>
      <ErrorText message={error} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Clock size={14} />} label="Active courses" value={courses.length} sub={`${studentsTotal} enrollments`} />
        <StatCard icon={<Clock size={14} />} label="Published assignments" value={assignments.length} sub={`${upcoming.length} still open`} />
        <StatCard icon={<Clock size={14} />} label="Deadlines · 14 days" value={within14.length}
          sub={within14[0] ? `Next ${formatShort(within14[0].current_deadline)}` : 'Nothing due soon'} />
        <StatCard icon={<RefreshCw size={14} />} label="Deadline changes" value={Object.keys(changed).length} sub="Assignments with a changed deadline" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="!p-0 self-start">
          <div className="p-5"><h2 className="text-lg font-bold">Upcoming deadlines</h2></div>
          <AssignmentTable rows={rows} progress={{}} changed={changed} role="instructor" empty="No upcoming deadlines." />
          <div className="border-t border-slate-100 px-5 py-3">
            <Link to="/assignments" className="text-sm font-semibold text-indigo-700 hover:underline">View all assignments</Link>
          </div>
        </Card>
        <div className="space-y-5">
          <WeekStrip assignments={assignments} />
          <Card>
            <h2 className="mb-3 text-lg font-bold">My courses</h2>
            <ul className="space-y-3">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <CourseDot courseId={c.id} />
                  <Link to={`/courses/${c.id}`} className="truncate font-medium hover:text-indigo-700">{c.name}</Link>
                  <span className="ml-auto text-slate-500">{enrolled[c.id] ?? 0} students</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><History size={18} /> Recent changes</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">No deadline changes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {recent.map((r) => (
                  <li key={r.id}>
                    <div className="font-semibold">{r.assignments?.title}</div>
                    <div className="text-xs text-slate-500">
                      {formatDay(r.previous_deadline)} → {formatDay(r.new_deadline)} · {r.assignments?.courses?.name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
