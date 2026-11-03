import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, btnGhost, Card, ErrorText, input } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { Course } from '../lib/types'

export default function Courses() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    setCourses((data ?? []) as Course[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!profile) return null
  const isInstructor = profile.role === 'instructor'

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Courses</h1>
      {isInstructor ? (
        <CreateCourse instructorId={profile.id} onDone={load} />
      ) : (
        <EnrollForm onDone={load} />
      )}
      <ErrorText message={error} />
      {loading ? (
        <p>Loading…</p>
      ) : courses.length === 0 ? (
        <p className="text-slate-600">{isInstructor ? 'You have no courses yet.' : 'You are not enrolled in any course yet.'}</p>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Card className="flex flex-wrap items-center gap-3">
                <Link to={`/courses/${c.id}`} className="font-semibold text-indigo-700 hover:underline">
                  {c.course_code} — {c.name}
                </Link>
                {c.archived && <span className="rounded bg-slate-200 px-1.5 text-xs">Archived</span>}
                {isInstructor && (
                  <>
                    <span className="ml-auto text-sm">
                      Enrollment code: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{c.enrollment_code}</code>
                    </span>
                    <button
                      className={btnGhost}
                      onClick={async () => {
                        await supabase.from('courses').update({ archived: !c.archived }).eq('id', c.id)
                        void load()
                      }}
                    >
                      {c.archived ? 'Unarchive' : 'Archive'}
                    </button>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateCourse({ instructorId, onDone }: { instructorId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase
      .from('courses')
      .insert({ name: name.trim(), course_code: code.trim(), instructor_id: instructorId })
    if (error) return setError(error.message)
    setName('')
    setCode('')
    setError(null)
    onDone()
  }

  return (
    <Card className="mb-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Course code
          <input className={input} value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <label className="flex-1 text-sm">Course name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className={btn}>Create course</button>
      </form>
      <ErrorText message={error} />
    </Card>
  )
}

function EnrollForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    const { error } = await supabase.rpc('enroll_by_code', { p_code: code })
    if (error) return setError(error.message)
    setCode('')
    setError(null)
    setOk(true)
    onDone()
  }

  return (
    <Card className="mb-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm">Enrollment code
          <input className={input} value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button className={btn}>Enroll</button>
      </form>
      <ErrorText message={error} />
      {ok && <p className="text-sm text-green-700">Enrolled.</p>}
    </Card>
  )
}
