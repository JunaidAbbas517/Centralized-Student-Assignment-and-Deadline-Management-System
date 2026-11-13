import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import FilePicker from '../components/FilePicker'
import { btn, Card, courseTheme, ErrorText, input, label, SectionTitle, Segmented } from '../components/ui'
import { localInputToIso } from '../lib/dates'
import { ASSIGNMENT_BUCKET, extensionsFor, FILE_GROUPS, safeFileName, uploadFile } from '../lib/files'
import { setStarted } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Course, Profile, SubmissionType } from '../lib/types'
import { useAssignments } from '../lib/useAssignments'
import { isHandedIn } from '../lib/workStatus'
import { LoadingState } from './Dashboard'

type Student = Pick<Profile, 'id' | 'full_name' | 'email'>

export default function CourseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const role = profile?.role === 'instructor' ? 'instructor' : 'student'
  const { assignments, work, classWork, changed, reload } = useAssignments(role)

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
  const done = mine.filter((a) => isHandedIn(work[a.id]?.state)).length
  const graded = mine.filter((a) => work[a.id]?.state === 'graded').length

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
            {role === 'student' ? ` · ${done} submitted · ${graded} graded` : ` · ${students.length} ${students.length === 1 ? 'student' : 'students'}`}
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
            work={work}
            classWork={classWork}
            changed={changed}
            role={role}
            empty={role === 'instructor' ? 'Publish the first assignment on the right.' : 'No assignments yet.'}
            onStart={async (a) => {
              if (!profile) return
              await setStarted(profile.id, a.id, true)
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

const REFERENCE_RULES = { allowed_extensions: [] as string[], max_file_mb: 50, max_files: 10 }

function NewAssignment({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [totalMarks, setTotalMarks] = useState('100')
  const [submissionType, setSubmissionType] = useState<SubmissionType>('file')
  const [anyType, setAnyType] = useState(false)
  const [groups, setGroups] = useState<string[]>(['pdf'])
  const [maxFileMb, setMaxFileMb] = useState('20')
  const [maxFiles, setMaxFiles] = useState('5')
  const [summaryRequired, setSummaryRequired] = useState(true)
  const [allowLate, setAllowLate] = useState(true)
  const [references, setReferences] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const takesFiles = submissionType !== 'link'

  function reset() {
    setTitle('')
    setDescription('')
    setDeadline('')
    setReferences([])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const marks = Number(totalMarks)
    const mb = Number(maxFileMb)
    const count = Number(maxFiles)
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) return setError('Total marks must be a whole number from 1 to 1000.')
    if (takesFiles && (!Number.isInteger(mb) || mb < 1 || mb > 50)) return setError('Maximum file size must be from 1 to 50 MB.')
    if (takesFiles && (!Number.isInteger(count) || count < 1 || count > 20)) return setError('Maximum number of files must be from 1 to 20.')
    if (takesFiles && !anyType && groups.length === 0) return setError('Choose at least one accepted file type, or allow any type.')
    if (new Date(deadline).getTime() <= Date.now()) return setError('The deadline must be in the future.')

    setBusy(true)
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId,
        title: title.trim(),
        description,
        current_deadline: localInputToIso(deadline),
        total_marks: marks,
        submission_type: submissionType,
        allowed_extensions: takesFiles && !anyType ? extensionsFor(groups) : [],
        max_file_mb: takesFiles ? mb : 20,
        max_files: takesFiles ? count : 5,
        summary_required: summaryRequired,
        allow_late: allowLate,
      })
      .select('id')
      .single()
    if (error || !data) {
      setBusy(false)
      return setError(error?.message ?? 'Could not publish the assignment.')
    }

    const failed: string[] = []
    for (const file of references) {
      const path = `${data.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const upErr = await uploadFile(ASSIGNMENT_BUCKET, path, file)
      if (upErr) {
        failed.push(upErr)
        continue
      }
      const row = await supabase.from('assignment_files').insert({ assignment_id: data.id, path, name: file.name, size: file.size })
      if (row.error) failed.push(`${file.name}: ${row.error.message}`)
    }
    setBusy(false)
    reset()
    if (failed.length) setError(`Published, but some files did not upload: ${failed.join('; ')}`)
    onDone()
  }

  const check = 'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200'

  return (
    <Card className="rise" style={{ ['--i' as string]: 3 }}>
      <h2 className="mb-4 text-lg font-semibold">Publish an assignment</h2>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Title
          <input className={`${input} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Instructions
          <textarea className={`${input} mt-1.5`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What students need to do, how it is marked…" />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <label className="block text-sm font-medium text-slate-700">Deadline
            <input className={`${input} mt-1.5`} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">Marks
            <input className={`${input} mt-1.5`} type="number" min={1} max={1000} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} required />
          </label>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-700">Reference files <span className="font-normal text-slate-400">(optional)</span></div>
          <FilePicker files={references} onChange={setReferences} allowedExtensions={REFERENCE_RULES.allowed_extensions} maxFileMb={REFERENCE_RULES.max_file_mb} maxFiles={REFERENCE_RULES.max_files} disabled={busy} />
        </div>

        <fieldset className="space-y-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/70">
          <legend className={`${label} float-left mb-1 w-full`}>How students submit</legend>
          <Segmented
            value={submissionType}
            onChange={setSubmissionType}
            options={[{ value: 'file', label: 'Files' }, { value: 'link', label: 'Link' }, { value: 'file_and_link', label: 'Both' }]}
          />

          {takesFiles && (
            <>
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">Accepted file types</div>
                <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className={check} checked={anyType} onChange={(e) => setAnyType(e.target.checked)} /> Any file type
                </label>
                {!anyType && (
                  <div className="flex flex-wrap gap-1.5">
                    {FILE_GROUPS.map((g) => {
                      const on = groups.includes(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setGroups(on ? groups.filter((x) => x !== g.id) : [...groups, g.id])}
                          className={`tap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'}`}
                        >
                          {g.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">Max size (MB)
                  <input className={`${input} mt-1.5`} type="number" min={1} max={50} value={maxFileMb} onChange={(e) => setMaxFileMb(e.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">Max files
                  <input className={`${input} mt-1.5`} type="number" min={1} max={20} value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} />
                </label>
              </div>
            </>
          )}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className={`${check} mt-0.5`} checked={summaryRequired} onChange={(e) => setSummaryRequired(e.target.checked)} />
            <span>Require a short summary of the work</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className={`${check} mt-0.5`} checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
            <span>Accept late work <span className="block text-xs text-slate-500">Late submissions are marked as late. Untick to close submissions at the deadline.</span></span>
          </label>
        </fieldset>

        <ErrorText message={error} />
        <button className={`${btn} w-full`} disabled={busy}><Plus size={16} /> {busy ? 'Publishing…' : 'Publish to students'}</button>
      </form>
    </Card>
  )
}
