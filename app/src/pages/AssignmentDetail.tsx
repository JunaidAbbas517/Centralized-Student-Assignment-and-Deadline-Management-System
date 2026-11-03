import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, btnGhost, Card, courseColor, ErrorText, input } from '../components/ui'
import { formatDateTime, localInputToIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Assignment, DeadlineChange, ProgressStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'

type AssignmentWithCourse = Assignment & { courses: { name: string; course_code: string } | null }

export default function AssignmentDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<AssignmentWithCourse | null>(null)
  const [history, setHistory] = useState<DeadlineChange[]>([])
  const [status, setStatus] = useState<ProgressStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const a = await supabase.from('assignments').select('*, courses(name, course_code)').eq('id', id).single()
    setAssignment((a.data as AssignmentWithCourse) ?? null)
    const h = await supabase
      .from('deadline_changes')
      .select('*')
      .eq('assignment_id', id)
      .order('changed_at', { ascending: false })
    setHistory((h.data ?? []) as DeadlineChange[])
    if (profile?.role === 'student') {
      const p = await supabase.from('assignment_progress').select('status').eq('assignment_id', id).maybeSingle()
      setStatus((p.data?.status as ProgressStatus) ?? 'pending')
    }
    setLoading(false)
  }, [id, profile?.role])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(next: ProgressStatus) {
    if (!profile) return
    const { error } = await supabase
      .from('assignment_progress')
      .upsert(
        { student_id: profile.id, assignment_id: id, status: next, updated_at: new Date().toISOString() },
        { onConflict: 'student_id,assignment_id' },
      )
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

  if (loading) return <p>Loading…</p>
  if (!assignment) return <p>Assignment not found.</p>
  const isInstructor = profile?.role === 'instructor'

  return (
    <div className="space-y-4">
      <Link to={`/courses/${assignment.course_id}`} className="text-sm text-indigo-700 underline">← Back to course</Link>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded border px-1.5 text-xs ${courseColor(assignment.course_id)}`}>{assignment.courses?.course_code}</span>
          <h1 className="text-xl font-bold">{assignment.title}</h1>
        </div>
        <p className="mb-2 whitespace-pre-wrap text-slate-700">{assignment.description || 'No description.'}</p>
        <p className="font-medium">Deadline: {formatDateTime(assignment.current_deadline)}</p>
        <ErrorText message={error} />
      </Card>

      {!isInstructor && (
        <Card>
          <label className="text-sm font-medium">
            My progress{' '}
            <select
              className="ml-2 rounded border border-slate-300 px-2 py-1"
              value={status}
              onChange={(e) => void updateStatus(e.target.value as ProgressStatus)}
            >
              {(Object.keys(STATUS_LABEL) as ProgressStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-slate-500">Only you can see your progress.</p>
        </Card>
      )}

      {isInstructor && (
        <>
          <ChangeDeadline assignment={assignment} onDone={load} />
          <button className="text-sm text-red-700 underline" onClick={remove}>Delete assignment</button>
        </>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Deadline history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">The deadline has never been changed.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-l-4 border-red-300 pl-3">
                {formatDateTime(h.previous_deadline)} → <strong>{formatDateTime(h.new_deadline)}</strong>
                <div className="text-slate-500">
                  Changed {formatDateTime(h.changed_at)}
                  {h.reason ? ` — ${h.reason}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
    if (next.getTime() === new Date(assignment.current_deadline).getTime())
      return setError('The new deadline is the same as the current one.')
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
    <Card>
      <h2 className="mb-2 font-semibold">Change deadline</h2>
      {!confirming ? (
        <form onSubmit={review} className="space-y-2">
          <label className="block text-sm">New deadline
            <input className={input} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
          <label className="block text-sm">Reason (optional)
            <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <ErrorText message={error} />
          <button className={btn}>Review change</button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded bg-slate-100 p-3"><div className="text-slate-500">Previous</div>{formatDateTime(assignment.current_deadline)}</div>
            <div className="rounded bg-amber-100 p-3"><div className="text-slate-600">Proposed</div>{formatDateTime(localInputToIso(value))}</div>
          </div>
          <p className="text-sm">All enrolled students will be notified. Confirm this change?</p>
          <div className="flex gap-2">
            <button className={btn} onClick={confirm} disabled={busy}>Confirm change</button>
            <button className={btnGhost} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}
