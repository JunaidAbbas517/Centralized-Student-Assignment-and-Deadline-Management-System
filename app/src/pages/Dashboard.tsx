import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Bell, Plus, RefreshCw, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import DeadlineRibbon from '../components/DeadlineRibbon'
import {
  btn, btnGhost, Card, CourseDot, courseTheme, ErrorText, firstName, label, SectionTitle, Segmented,
} from '../components/ui'
import {
  daysFromToday, formatDay, formatLongDate, formatShort, greeting, isOverdue, relativeLabel, whenLabel, whenPhrase,
} from '../lib/dates'
import { notifyNotificationsChanged, saveProgress } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Course, Notification } from '../lib/types'
import { useAssignments, type AssignmentWithCourse } from '../lib/useAssignments'

export default function Dashboard() {
  const { profile } = useAuth()
  if (!profile) return null
  return profile.role === 'student' ? <StudentDashboard /> : <InstructorDashboard />
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative hidden sm:block">
      <span className="sr-only">Search assignments</span>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search assignments"
        className="w-64 rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  )
}

function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="rise mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className={label}>{formatLongDate()}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** One number in the hero's figure strip. */
function Figure({ value, caption, sub, tone }: { value: number; caption: string; sub: string; tone?: 'alert' }) {
  return (
    <div className="min-w-0 py-1 pr-4 sm:px-5 sm:first:pl-0">
      <div className={`tnum font-display text-[2.1rem] font-semibold leading-none ${tone === 'alert' && value > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
        {value}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-800">{caption}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  )
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
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
  const open = assignments.filter((a) => statusOf(a.id) !== 'completed')
  const overdue = open.filter((a) => isOverdue(a.current_deadline))
  const upcoming = open.filter((a) => !isOverdue(a.current_deadline))
  const thisWeek = upcoming.filter((a) => daysFromToday(a.current_deadline) <= 7)
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
      if ((progress[a.id] ?? 'pending') === 'completed') c.done++
      map.set(a.course_id, c)
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [assignments, progress])

  if (loading) return <LoadingState />
  const next = upcoming[0]

  // One plain sentence about the week ahead.
  const summary = [
    thisWeek.length ? `You have ${plural(thisWeek.length, 'deadline')} in the next 7 days.` : 'Nothing is due in the next 7 days.',
    next ? `Next up is ${next.title.split(':')[0]}, ${relativeLabel(next.current_deadline).text}.` : '',
    overdue.length ? `${plural(overdue.length, 'assignment')} ${overdue.length === 1 ? 'is' : 'are'} past due.` : '',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
        <button
          aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
          className="tap relative rounded-xl border border-slate-200 bg-white/80 p-2.5 text-slate-600 hover:bg-white hover:text-slate-900"
          onClick={() => navigate('/notifications')}
        >
          <Bell size={18} />
          {unread.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
        </button>
        <Link to="/courses" className={btn}><Plus size={16} /> Enroll in a course</Link>
      </Toolbar>
      <ErrorText message={error} />

      {banner && bannerAssignment && bannerChange && (
        <div className="rise mb-5 flex flex-wrap items-center gap-4 rounded-[20px] border border-orange-200/80 bg-gradient-to-r from-orange-50 to-[var(--panel)] p-4 pr-5" style={{ ['--i' as string]: 1 }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-[0_1px_2px_rgba(25,25,39,.06)] ring-1 ring-orange-200">
            <RefreshCw size={17} />
          </div>
          <div className="min-w-[min(100%,18rem)] flex-1 text-sm leading-relaxed">
            <div className="font-semibold text-slate-900">A deadline moved in {bannerAssignment.courses?.name}</div>
            <div className="text-slate-600">
              {bannerAssignment.title} moved from <s className="text-slate-400">{formatShort(bannerChange.previous_deadline)}</s> to{' '}
              <strong className="font-semibold text-slate-900">{formatShort(bannerChange.new_deadline)}</strong>.{' '}
              {people[bannerChange.changed_by] ?? 'Your instructor'} changed it {whenPhrase(bannerChange.changed_at)}.
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to={`/assignments/${bannerAssignment.id}`} className={btnGhost}>See history</Link>
            <button className="tap rounded-xl px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100/60" onClick={() => void markRead(banner.id)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Hero: greeting, the week in one sentence, four figures, and the ribbon. */}
      <Card className="rise mb-6 !p-0 overflow-hidden" style={{ ['--i' as string]: 2 }}>
        <div className="grid gap-6 p-7 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900">
              {greeting()}, {firstName(profile?.full_name ?? '')}.
            </h1>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-slate-600">{summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-4 divide-slate-200 sm:grid-cols-4 sm:divide-x">
            <Figure value={thisWeek.length} caption="This week" sub={next ? `Next ${formatDay(next.current_deadline)}` : 'All clear'} />
            <Figure value={inProgress.length} caption="In progress" sub={`${new Set(inProgress.map((a) => a.course_id)).size} courses`} />
            <Figure value={completed.length} caption="Completed" sub={`of ${assignments.length}`} />
            <Figure value={overdue.length} caption="Overdue" sub={overdue[0] ? overdue[0].title.split(':')[0] : 'None'} tone="alert" />
          </div>
        </div>
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/40 to-transparent px-7 pb-4 pt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className={label}>The next two weeks</span>
            <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              Full calendar <ArrowRight size={14} />
            </Link>
          </div>
          <DeadlineRibbon assignments={assignments} changed={changed} progress={progress} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="rise !p-0 self-start" style={{ ['--i' as string]: 3 }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-5">
            <h2 className="text-lg font-semibold">What to work on</h2>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[{ value: 'all', label: 'All open' }, { value: 'week', label: 'This week' }, { value: 'overdue', label: 'Overdue' }]}
            />
          </div>
          <AssignmentTable
            rows={tab === 'all' && !query ? rows.slice(0, 6) : rows}
            progress={progress}
            changed={changed}
            role="student"
            empty={query ? 'No assignments match your search.' : 'Nothing here. Enjoy the quiet.'}
            onStatus={async (a, s) => {
              if (!profile) return
              await saveProgress(profile.id, a.id, s)
              await reload()
            }}
          />
          <div className="border-t border-slate-100 px-6 py-3.5">
            <Link to="/assignments" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              All assignments <ArrowRight size={14} />
            </Link>
          </div>
        </Card>

        <div className="space-y-6">
          <CourseProgress courses={courses} delay={4} />
          <Card className="rise" style={{ ['--i' as string]: 5 }}>
            <SectionTitle aside={<Link to="/notifications" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">View all</Link>}>
              Latest news
            </SectionTitle>
            {notifs.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[3.5px] before:top-2 before:w-px before:bg-slate-200">
                {notifs.slice(0, 3).map((n) => (
                  <li key={n.id} className="relative flex gap-3.5">
                    <span
                      className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-[var(--panel)]"
                      style={{ background: n.is_read || !n.assignments ? '#cbcbd8' : courseTheme(n.assignments.course_id).dot }}
                    />
                    <div className="min-w-0 text-sm">
                      <div className={`leading-snug ${n.is_read ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>{n.message}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {n.assignments?.courses?.name} · {whenLabel(n.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function CourseProgress({ courses, delay }: { courses: { id: string; name: string; total: number; done: number }[]; delay: number }) {
  return (
    <Card className="rise" style={{ ['--i' as string]: delay }}>
      <SectionTitle aside={<span className="text-xs text-slate-500">Completed</span>}>Your courses</SectionTitle>
      {courses.length === 0 ? (
        <p className="text-sm text-slate-500">Enroll in a course to see it here.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((c) => {
            const pct = c.total ? (c.done / c.total) * 100 : 0
            return (
              <li key={c.id}>
                <div className="flex items-baseline gap-2.5 text-sm">
                  <CourseDot courseId={c.id} className="translate-y-[-1px]" />
                  <span className="truncate font-medium text-slate-800">{c.name}</span>
                  <span className="tnum ml-auto shrink-0 font-mono text-xs text-slate-500">{c.done}/{c.total}</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={c.done}
                  aria-valuemin={0}
                  aria-valuemax={c.total}
                  aria-label={`${c.name}: ${c.done} of ${c.total} completed`}
                >
                  <div
                    className="h-full origin-left rounded-full"
                    style={{ transform: `scaleX(${pct / 100})`, background: courseTheme(c.id).dot, transition: 'transform 1s var(--ease-out-soft)' }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function LoadingState() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fade h-28 animate-pulse rounded-[20px] bg-white/60" style={{ ['--i' as string]: i }} />
      ))}
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

  if (loading) return <LoadingState />
  const upcoming: AssignmentWithCourse[] = assignments.filter((a) => !isOverdue(a.current_deadline))
  const thisWeek = upcoming.filter((a) => daysFromToday(a.current_deadline) <= 7)
  const rows = upcoming.filter((a) => `${a.title} ${a.courses?.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  const studentsTotal = Object.values(enrolled).reduce((x, y) => x + y, 0)
  const next = upcoming[0]

  const summary = [
    thisWeek.length ? `${plural(thisWeek.length, 'deadline')} land in the next 7 days across your courses.` : 'No deadlines in the next 7 days.',
    next ? `The nearest is ${next.title.split(':')[0]}, ${relativeLabel(next.current_deadline).text}.` : '',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
        <Link to="/courses" className={btn}><Plus size={16} /> New course</Link>
      </Toolbar>
      <ErrorText message={error} />

      <Card className="rise mb-6 !p-0 overflow-hidden" style={{ ['--i' as string]: 1 }}>
        <div className="grid gap-6 p-7 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900">
              {greeting()}, {profile?.full_name}.
            </h1>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-slate-600">{summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-4 divide-slate-200 sm:grid-cols-4 sm:divide-x">
            <Figure value={courses.length} caption="Courses" sub={`${studentsTotal} enrollments`} />
            <Figure value={assignments.length} caption="Published" sub={`${upcoming.length} still open`} />
            <Figure value={thisWeek.length} caption="This week" sub={next ? `Next ${formatDay(next.current_deadline)}` : 'All clear'} />
            <Figure value={Object.keys(changed).length} caption="Moved" sub="deadlines changed" />
          </div>
        </div>
        <div className="border-t border-slate-100 px-7 pb-4 pt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className={label}>The next two weeks</span>
            <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              Full calendar <ArrowRight size={14} />
            </Link>
          </div>
          <DeadlineRibbon assignments={assignments} changed={changed} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="rise !p-0 self-start" style={{ ['--i' as string]: 2 }}>
          <div className="px-6 pb-4 pt-5"><h2 className="text-lg font-semibold">Coming up</h2></div>
          <AssignmentTable rows={rows} progress={{}} changed={changed} role="instructor" empty="No upcoming deadlines." />
          <div className="border-t border-slate-100 px-6 py-3.5">
            <Link to="/assignments" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              All assignments <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="rise" style={{ ['--i' as string]: 3 }}>
            <SectionTitle aside={<span className="text-xs text-slate-500">Students</span>}>Your courses</SectionTitle>
            <ul className="space-y-3.5">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 text-sm">
                  <CourseDot courseId={c.id} />
                  <Link to={`/courses/${c.id}`} className="truncate font-medium text-slate-800 hover:text-indigo-700">{c.name}</Link>
                  <span className="tnum ml-auto font-mono text-xs text-slate-500">{enrolled[c.id] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="rise" style={{ ['--i' as string]: 4 }}>
            <SectionTitle aside={<Link to="/history" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">History</Link>}>
              Recent changes
            </SectionTitle>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">No deadline changes yet.</p>
            ) : (
              <ul className="space-y-3.5 text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex gap-3">
                    <RefreshCw size={14} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{r.assignments?.title}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {formatDay(r.previous_deadline)} → {formatDay(r.new_deadline)}
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
