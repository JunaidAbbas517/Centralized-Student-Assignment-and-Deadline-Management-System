import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentRow from '../components/AssignmentRow'
import { Card, ErrorText } from '../components/ui'
import { formatDateTime, isOverdue } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Course } from '../lib/types'
import { useAssignments } from '../lib/useAssignments'

export default function Dashboard() {
  const { profile } = useAuth()
  if (!profile) return null
  return profile.role === 'student' ? <StudentDashboard /> : <InstructorDashboard />
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">
        {title} <span className="text-sm font-normal text-slate-500">({count})</span>
      </h2>
      {count === 0 ? <p className="text-sm text-slate-500">Nothing here.</p> : <ul className="space-y-1">{children}</ul>}
    </section>
  )
}

function StudentDashboard() {
  const { assignments, progress, changed, loading, error } = useAssignments('student')
  if (loading) return <p>Loading…</p>

  const statusOf = (id: string) => progress[id] ?? 'pending'
  const completed = assignments.filter((a) => statusOf(a.id) === 'completed')
  const open = assignments.filter((a) => statusOf(a.id) !== 'completed')
  const overdue = open.filter((a) => isOverdue(a.current_deadline))
  const upcoming = open.filter((a) => !isOverdue(a.current_deadline))
  const row = (a: (typeof assignments)[number]) => (
    <AssignmentRow key={a.id} assignment={a} status={statusOf(a.id)} changed={Boolean(changed[a.id])} />
  )

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My dashboard</h1>
      <ErrorText message={error} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Upcoming', upcoming.length],
          ['Pending / in progress', open.length],
          ['Completed', completed.length],
          ['Overdue', overdue.length],
        ].map(([label, n]) => (
          <Card key={label}>
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-sm text-slate-600">{label}</div>
          </Card>
        ))}
      </div>
      {assignments.length === 0 && (
        <p className="mb-4 text-slate-600">
          No assignments yet. <Link className="text-indigo-700 underline" to="/courses">Enroll in a course</Link> with a code from your instructor.
        </p>
      )}
      <Section title="Overdue" count={overdue.length}>{overdue.map(row)}</Section>
      <Section title="Upcoming" count={upcoming.length}>{upcoming.map(row)}</Section>
      <Section title="Completed" count={completed.length}>{completed.map(row)}</Section>
    </div>
  )
}

interface RecentChange {
  id: string
  previous_deadline: string
  new_deadline: string
  changed_at: string
  assignments: { title: string; courses: { course_code: string } | null } | null
}

function InstructorDashboard() {
  const { assignments, loading, error } = useAssignments('instructor')
  const [courses, setCourses] = useState<Course[]>([])
  const [recent, setRecent] = useState<RecentChange[]>([])

  useEffect(() => {
    void (async () => {
      const c = await supabase.from('courses').select('*').eq('archived', false)
      setCourses((c.data ?? []) as Course[])
      const r = await supabase
        .from('deadline_changes')
        .select('id, previous_deadline, new_deadline, changed_at, assignments(title, courses(course_code))')
        .order('changed_at', { ascending: false })
        .limit(5)
      setRecent((r.data ?? []) as unknown as RecentChange[])
    })()
  }, [])

  if (loading) return <p>Loading…</p>
  const upcoming = assignments.filter((a) => !isOverdue(a.current_deadline)).slice(0, 8)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Instructor dashboard</h1>
      <ErrorText message={error} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><div className="text-2xl font-bold">{courses.length}</div><div className="text-sm text-slate-600">Active courses</div></Card>
        <Card><div className="text-2xl font-bold">{assignments.length}</div><div className="text-sm text-slate-600">Published assignments</div></Card>
        <Card><div className="text-2xl font-bold">{upcoming.length}</div><div className="text-sm text-slate-600">Upcoming deadlines</div></Card>
      </div>
      <Section title="Upcoming deadlines" count={upcoming.length}>
        {upcoming.map((a) => <AssignmentRow key={a.id} assignment={a} />)}
      </Section>
      <Section title="Recent deadline changes" count={recent.length}>
        {recent.map((r) => (
          <li key={r.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
            <strong>{r.assignments?.courses?.course_code}</strong> {r.assignments?.title}:{' '}
            {formatDateTime(r.previous_deadline)} → {formatDateTime(r.new_deadline)}
            <span className="ml-2 text-slate-500">({formatDateTime(r.changed_at)})</span>
          </li>
        ))}
      </Section>
    </div>
  )
}
