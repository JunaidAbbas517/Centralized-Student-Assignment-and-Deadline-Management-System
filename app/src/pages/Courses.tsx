import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, ArrowRight, Check, Copy, KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, Card, courseTheme, ErrorText, input, label, PageHeader, registerCourses } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { Course } from '../lib/types'
import { LoadingState } from './Dashboard'

export default function Courses() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    const rows = (data ?? []) as Course[]
    registerCourses([...rows].sort((a, b) => a.course_code.localeCompare(b.course_code)).map((c) => c.id))
    setCourses(rows)
    const a = await supabase.from('assignments').select('course_id')
    const n: Record<string, number> = {}
    for (const r of (a.data ?? []) as { course_id: string }[]) n[r.course_id] = (n[r.course_id] ?? 0) + 1
    setCounts(n)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!profile) return null
  const isInstructor = profile.role === 'instructor'

  return (
    <div>
      <PageHeader eyebrow={isInstructor ? 'Courses you teach' : 'Courses you take'} title="Courses" />
      {isInstructor ? <CreateCourse instructorId={profile.id} onDone={load} /> : <EnrollForm onDone={load} />}
      <ErrorText message={error} />

      {loading ? (
        <LoadingState />
      ) : courses.length === 0 ? (
        <p className="mt-8 text-center text-slate-500">
          {isInstructor ? 'Create your first course above.' : 'Enter a code above to join your first course.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c, i) => (
            <li key={c.id} className="rise" style={{ ['--i' as string]: i + 2 }}>
              <CourseCard course={c} count={counts[c.id] ?? 0} isInstructor={isInstructor} onChange={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CourseCard({ course: c, count, isInstructor, onChange }: { course: Course; count: number; isInstructor: boolean; onChange: () => void }) {
  const t = courseTheme(c.id)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.enrollment_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard blocked; the code is still visible to copy by hand
    }
  }

  return (
    <Card className={`group relative flex h-full flex-col !p-0 overflow-hidden ${c.archived ? 'opacity-60' : ''}`}>
      <div className="relative h-24 overflow-hidden" style={{ background: t.bg }} aria-hidden="true">
        {/* A small drawn ribbon in the course colour */}
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <line x1="0" x2="200" y1="38" y2="38" stroke={t.dot} strokeOpacity=".25" strokeWidth="1" />
          {[28, 74, 118, 166].map((x) => <circle key={x} cx={x} cy="38" r="3.5" fill={t.dot} fillOpacity=".55" />)}
          <path d="M 118 38 C 118 56, 166 56, 166 38" fill="none" stroke={t.dot} strokeOpacity=".5" strokeDasharray="3 3" />
        </svg>
        <span className="absolute left-5 top-4 rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] font-medium" style={{ color: t.text }}>
          {c.course_code}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/courses/${c.id}`} className="font-display text-lg font-semibold leading-snug tracking-tight text-slate-900 after:absolute after:inset-0 hover:text-indigo-700">
          {c.name}
        </Link>
        <div className="mt-1 text-sm text-slate-500">
          {count} {count === 1 ? 'assignment' : 'assignments'}{c.archived ? ' · Archived' : ''}
        </div>

        {isInstructor ? (
          <div className="relative z-10 mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
            <div className="min-w-0 flex-1">
              <div className={label}>Enrollment code</div>
              <code className="mt-0.5 block font-mono text-sm font-medium tracking-wider text-slate-900">{c.enrollment_code}</code>
            </div>
            <button
              onClick={copy}
              className="tap rounded-lg p-2 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-900"
              aria-label={copied ? 'Copied' : `Copy enrollment code ${c.enrollment_code}`}
              title="Copy code"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
            <button
              className="tap rounded-lg p-2 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-900"
              aria-label={c.archived ? `Unarchive ${c.name}` : `Archive ${c.name}`}
              title={c.archived ? 'Unarchive' : 'Archive'}
              onClick={async () => {
                await supabase.from('courses').update({ archived: !c.archived }).eq('id', c.id)
                onChange()
              }}
            >
              {c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-indigo-700">
            Open course <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
        )}
      </div>
    </Card>
  )
}

function CreateCourse({ instructorId, onDone }: { instructorId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('courses').insert({ name: name.trim(), course_code: code.trim(), instructor_id: instructorId })
    if (error) return setError(error.message)
    setName('')
    setCode('')
    setError(null)
    onDone()
  }

  return (
    <Card className="rise" style={{ ['--i' as string]: 1 }}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-medium text-slate-700">Course code
          <input className={`${input} mt-1.5 font-mono`} placeholder="CS540" value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Course name
          <input className={`${input} mt-1.5`} placeholder="Computer Vision" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className={btn}><Plus size={16} /> Create course</button>
      </form>
      <ErrorText message={error} />
      <p className="mt-3 text-xs text-slate-500">Each new course gets its own enrollment code to share with students.</p>
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
    <Card className="rise" style={{ ['--i' as string]: 1 }}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <KeyRound size={19} aria-hidden="true" />
        </div>
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-base font-semibold">Join a course</h2>
          <p className="text-sm text-slate-500">Your instructor shares an 8 character code. Its deadlines appear here right away.</p>
        </div>
        <form onSubmit={submit} className="flex w-full gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="enroll-code">Enrollment code</label>
          <input
            id="enroll-code"
            className={`${input} font-mono uppercase tracking-widest sm:w-48`}
            placeholder="ML510ABC"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className={btn}>Join</button>
        </form>
      </div>
      <div className="mt-2">
        <ErrorText message={error} />
        {ok && <p className="text-sm text-emerald-700">You are in. The course is listed below.</p>}
      </div>
    </Card>
  )
}
