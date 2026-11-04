import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import { btn, Card, courseTheme, ErrorText, input, label, SectionTitle } from '../components/ui'
import { localInputToIso } from '../lib/dates'
import { saveProgress } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Course, Profile } from '../lib/types'
import { useAssignments } from '../lib/useAssignments'
import { LoadingState } from './Dashboard'

type Student = Pick<Profile, 'id' | 'full_name' | 'email'>

export default function CourseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const role = profile?.role ?? 'student'
  const { assignments, progress, changed, reload } = useAssignments(role)

  const loadCourse = useCallback(async () => {
    const c = await supabase.from('courses').select('*').eq('id', id).single()
    setCourse((c.data as Course) ?? null)
    if (role === 'instructor') {
      const e = await supabase.from('enrollments').select('profiles(id, full_name, email)').eq('course_id', id)
      setStudents(((e.data ?? []) as unknown as { profiles: Student }[]).map((r) => r.profiles))
    }
    setLoading(false)
  }, [id, role])

  useEffect(() => {
    void loadCourse()
  }, [loadCourse])

  if (loading) return <LoadingState />
  if (!course) return <p className="text-slate-600">This course could not be found.</p>
  const mine = assignments.filter((a) => a.course_id === course.id)
  const t = courseTheme(course.id)
  const done = mine.filter((a) => progress[a.id] === 'completed').length

  return (
    <div>
      <Link to="/courses" className="rise mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> All courses
      </Link>

      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4" style={{ ['--i' as string]: 1 }}>
        <div>
          <span className="rounded-md px-2 py-0.5 font-mono text-[11px] font-medium" style={{ background: t.bg, color: t.text }}>{course.course_code}</span>
          <h1 className="mt-2 text-[2.2rem] font-semibold leading-tight tracking-[-0.025em]">{course.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mine.length} {mine.length === 1 ? 'assignment' : 'assignments'}
            {role === 'student' ? ` · ${done} completed` : ` · ${students.length} ${students.length === 1 ? 'student' : 'students'}`}
          </p>
        </div>
        {role === 'instructor' && (
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-right">
            <div className={label}>Enrollment code</div>
            <code className="font-mono text-base font-medium tracking-widest">{course.enrollment_code}</code>
          </div>
        )}
      </div>

      <div className={`grid gap-6 ${role === 'instructor' ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
        <Card className="rise !p-0 self-start" style={{ ['--i' as string]: 2 }}>
          <div className="px-6 pb-4 pt-5"><h2 className="text-lg font-semibold">Assignments</h2></div>
          <AssignmentTable
            rows={mine}
            progress={progress}
            changed={changed}
            role={role}
            empty={role === 'instructor' ? 'Publish the first assignment on the right.' : 'No assignments yet.'}
            onStatus={async (a, s) => {
              if (!profile) return
              await saveProgress(profile.id, a.id, s)
              await reload()
            }}
          />
        </Card>

        {role === 'instructor' && (
          <div className="space-y-6">
            <NewAssignment courseId={course.id} onDone={reload} />
            <Card className="rise" style={{ ['--i' as string]: 4 }}>
              <SectionTitle aside={<span className="tnum font-mono text-xs text-slate-500">{students.length}</span>}>Students</SectionTitle>
              {students.length === 0 ? (
                <p className="text-sm text-slate-500">Nobody has joined yet. Share the code above.</p>
              ) : (
                <ul className="space-y-2.5">
                  {students.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {(s.full_name || s.email).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="truncate font-medium text-slate-800">{s.full_name || s.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
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
    <Card className="rise" style={{ ['--i' as string]: 3 }}>
      <h2 className="mb-4 text-lg font-semibold">Publish an assignment</h2>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Title
          <input className={`${input} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Description
          <textarea className={`${input} mt-1.5`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Deadline
          <input className={`${input} mt-1.5`} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </label>
        <ErrorText message={error} />
        <button className={`${btn} w-full`}><Plus size={16} /> Publish to students</button>
      </form>
    </Card>
  )
}
