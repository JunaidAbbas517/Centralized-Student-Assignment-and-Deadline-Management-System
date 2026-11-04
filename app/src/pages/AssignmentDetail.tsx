import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import DeadlineTimeline from '../components/DeadlineTimeline'
import { btn, btnGhost, Card, CourseDot, courseTheme, ErrorText, input, label, Pill, Segmented } from '../components/ui'
import { daysFromToday, formatDay, formatFull, isOverdue, localInputToIso, relativeLabel } from '../lib/dates'
import { saveProgress } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Assignment, DeadlineChange, ProgressStatus } from '../lib/types'
import { LoadingState } from './Dashboard'

type AssignmentWithCourse = Assignment & { courses: { name: string; course_code: string } | null }

export default function AssignmentDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<AssignmentWithCourse | null>(null)
  const [history, setHistory] = useState<DeadlineChange[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ProgressStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const a = await supabase.from('assignments').select('*, courses(name, course_code)').eq('id', id).single()
    setAssignment((a.data as AssignmentWithCourse) ?? null)
    const h = await supabase.from('deadline_changes').select('*').eq('assignment_id', id).order('changed_at', { ascending: false })
    setHistory((h.data ?? []) as DeadlineChange[])
    const p = await supabase.from('profiles').select('id, full_name')
    const names: Record<string, string> = {}
    for (const x of (p.data ?? []) as { id: string; full_name: string }[]) names[x.id] = x.full_name
    setPeople(names)
    if (profile?.role === 'student') {
      const s = await supabase.from('assignment_progress').select('status').eq('assignment_id', id).maybeSingle()
      setStatus((s.data?.status as ProgressStatus) ?? 'pending')
    }
    setLoading(false)
  }, [id, profile?.role])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(next: ProgressStatus) {
    if (!profile || !id) return
    const { error } = await saveProgress(profile.id, id, next)
    if (error) return setError(error.message)
    setError(null)
    setStatus(next)
  }

  async function remove() {
    if (!assignment || !window.confirm('Delete this assignment? Students will no longer see it.')) return
    const { error } = await supabase.from('assignments').delete().eq('id', assignment.id)
    if (error) return setError(error.message)
    navigate(`/courses/${assignment.course_id}`)
  }

  if (loading) return <LoadingState />
  if (!assignment) return <p className="text-slate-600">This assignment could not be found.</p>

  const isInstructor = profile?.role === 'instructor'
  const theme = courseTheme(assignment.course_id)
  const latest = history[0]
  const rel = relativeLabel(assignment.current_deadline)
  const late = status !== 'completed' && isOverdue(assignment.current_deadline)
  const shift = latest ? Math.round((new Date(latest.new_deadline).getTime() - new Date(latest.previous_deadline).getTime()) / 86400000) : 0

  return (
    <div>
      <Link to={`/courses/${assignment.course_id}`} className="rise mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> {assignment.courses?.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="rise !p-0 overflow-hidden" style={{ ['--i' as string]: 1 }}>
            <div className="h-1.5" style={{ background: theme.dot }} aria-hidden="true" />
            <div className="p-7">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: theme.text }}>
                <CourseDot courseId={assignment.course_id} /> {assignment.courses?.name}
                <span className="font-mono text-[11px] text-slate-400">{assignment.courses?.course_code}</span>
              </div>
              <h1 className="mt-2 text-[2.2rem] font-semibold leading-tight tracking-[-0.025em]">{assignment.title}</h1>
              <p className="mt-3 max-w-[65ch] whitespace-pre-wrap leading-relaxed text-slate-600">
                {assignment.description || 'No description yet.'}
              </p>

              <div className="mt-7 grid gap-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-inset ring-slate-200/70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <div className={label}>Current deadline</div>
                  <div className="tnum mt-1.5 font-display text-2xl font-semibold tracking-tight">{formatFull(assignment.current_deadline)}</div>
                  <div className={`mt-1 font-mono text-xs ${late ? 'text-rose-700' : 'text-slate-500'}`}>{rel.text}</div>
                </div>
                {latest && (
                  <Pill tone="changed">
                    <RefreshCw size={11} /> Moved {daysFromToday(latest.changed_at) === 0 ? 'today' : formatDay(latest.changed_at)} · {shift >= 0 ? '+' : ''}{shift} days
                  </Pill>
                )}
              </div>
              <ErrorText message={error} />
            </div>
          </Card>

          {isInstructor ? (
            <>
              <ChangeDeadline assignment={assignment} onDone={load} />
              <button onClick={remove} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-700">
                <Trash2 size={14} /> Delete assignment
              </button>
            </>
          ) : (
            <Card className="rise" style={{ ['--i' as string]: 2 }}>
              <h2 className="text-lg font-semibold">Your progress</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">Only you can see this. Your instructor and classmates cannot.</p>
              <Segmented
                value={status}
                onChange={(s) => void updateStatus(s)}
                options={[{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }]}
              />
            </Card>
          )}
        </div>

        <Card className="rise self-start" style={{ ['--i' as string]: 3 }}>
          <h2 className="mb-5 text-lg font-semibold">Deadline history</h2>
          <DeadlineTimeline changes={history} currentDeadline={assignment.current_deadline} createdAt={assignment.created_at} people={people} />
        </Card>
      </div>
    </div>
  )
}

function ChangeDeadline({ assignment, onDone }: { assignment: Assignment; onDone: () => void }) {
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function review(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const next = new Date(value)
    if (Number.isNaN(next.getTime())) return setError('Enter a valid date.')
    if (next.getTime() <= Date.now()) return setError('The new deadline must be in the future.')
    if (next.getTime() === new Date(assignment.current_deadline).getTime()) return setError('That is the same as the current deadline.')
    setConfirming(true)
  }

  async function confirm() {
    setBusy(true)
    const { error } = await supabase.rpc('change_deadline', {
      p_assignment: assignment.id,
      p_new_deadline: localInputToIso(value),
      p_expected_previous: assignment.current_deadline,
      p_reason: reason,
    })
    setBusy(false)
    if (error) {
      setConfirming(false)
      return setError(error.message)
    }
    setValue('')
    setReason('')
    setConfirming(false)
    onDone()
  }

  return (
    <Card className="rise" style={{ ['--i' as string]: 2 }}>
      <h2 className="text-lg font-semibold">Move the deadline</h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">Every enrolled student is told, and the old date stays in the history.</p>
      {!confirming ? (
        <form onSubmit={review} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">New deadline
            <input className={`${input} mt-1.5`} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">Reason <span className="font-normal text-slate-400">(optional)</span>
            <input className={`${input} mt-1.5`} placeholder="Tell students why" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <ErrorText message={error} />
            <button className={btn}>Review change</button>
          </div>
        </form>
      ) : (
        <div className="fade space-y-5">
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
              <div className={label}>Now</div>
              <div className="tnum mt-1 font-semibold text-slate-500 line-through decoration-slate-300">{formatFull(assignment.current_deadline)}</div>
            </div>
            <ArrowRight size={18} className="mx-auto rotate-90 text-slate-400 sm:rotate-0" aria-hidden="true" />
            <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-inset ring-indigo-200">
              <div className={`${label} !text-indigo-700`}>New</div>
              <div className="tnum mt-1 font-semibold text-slate-900">{formatFull(localInputToIso(value))}</div>
            </div>
          </div>
          {reason && <p className="text-sm text-slate-600">Reason: “{reason}”</p>}
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={confirm} disabled={busy}>{busy ? 'Saving…' : 'Confirm and notify students'}</button>
            <button className={btnGhost} onClick={() => setConfirming(false)} disabled={busy}>Go back</button>
          </div>
        </div>
      )}
    </Card>
  )
}
