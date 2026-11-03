import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentRow from '../components/AssignmentRow'
import { btn, Card, ErrorText, input } from '../components/ui'
import { localInputToIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Course, Profile } from '../lib/types'
import { useAssignments } from '../lib/useAssignments'

export default function CourseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([])
  const [loading, setLoading] = useState(true)
  const role = profile?.role ?? 'student'
  const { assignments, progress, changed, reload } = useAssignments(role)

  const loadCourse = useCallback(async () => {
    const c = await supabase.from('courses').select('*').eq('id', id).single()
    setCourse((c.data as Course) ?? null)
    if (role === 'instructor') {
      const e = await supabase
        .from('enrollments')
        .select('profiles(id, full_name, email)')
        .eq('course_id', id)
      setStudents(((e.data ?? []) as unknown as { profiles: Pick<Profile, 'id' | 'full_name' | 'email'> }[]).map((r) => r.profiles))
    }
    setLoading(false)
  }, [id, role])

  useEffect(() => {
    void loadCourse()
  }, [loadCourse])

  if (loading) return <p>Loading…</p>
  if (!course) return <p>Course not found.</p>
  const mine = assignments.filter((a) => a.course_id === course.id)

  return (
    <div>
      <h1 className="text-2xl font-bold">{course.course_code} — {course.name}</h1>
      {role === 'instructor' && (
        <p className="mb-4 text-sm text-slate-600">
          Enrollment code: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{course.enrollment_code}</code>
        </p>
      )}

      {role === 'instructor' && <NewAssignment courseId={course.id} onDone={reload} />}

      <h2 className="mb-2 mt-4 text-lg font-semibold">Assignments</h2>
      {mine.length === 0 ? (
        <p className="text-sm text-slate-500">No assignments yet.</p>
      ) : (
        <ul className="space-y-1">
          {mine.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              status={role === 'student' ? (progress[a.id] ?? 'pending') : undefined}
              changed={Boolean(changed[a.id])}
            />
          ))}
        </ul>
      )}

      {role === 'instructor' && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-semibold">Enrolled students ({students.length})</h2>
          {students.length === 0 ? (
            <p className="text-sm text-slate-500">No students have enrolled yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {students.map((s) => (
                <li key={s.id} className="rounded border border-slate-200 bg-white px-3 py-1.5">{s.full_name || s.email}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function NewAssignment({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('assignments').insert({
      course_id: courseId,
      title: title.trim(),
      description,
      current_deadline: localInputToIso(deadline),
    })
    if (error) return setError(error.message)
    setTitle('')
    setDescription('')
    setDeadline('')
    setError(null)
    onDone()
  }

  return (
    <Card>
      <h2 className="mb-2 font-semibold">Publish an assignment</h2>
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-sm">Title
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block text-sm">Description
          <textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block text-sm">Deadline
          <input className={input} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </label>
        <ErrorText message={error} />
        <button className={btn}>Publish</button>
      </form>
    </Card>
  )
}
