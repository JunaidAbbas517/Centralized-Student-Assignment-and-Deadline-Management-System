import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { AttemptCard } from './SubmissionPanel'
import { btn, btnGhost, Card, ErrorText, input, label, Pill, Segmented } from './ui'
import { formatStamp, isOverdue } from '../lib/dates'
import { formatMarks, gradeWork, loadGrades, loadSubmissions } from '../lib/submissions'
import { supabase } from '../lib/supabase'
import type { Assignment, Grade, Profile, Submission } from '../lib/types'

type Student = Pick<Profile, 'id' | 'full_name' | 'email'>
type State = 'returned' | 'draft' | 'to_grade' | 'missing' | 'not_submitted'
type Filter = 'all' | 'to_grade' | 'missing' | 'graded'

interface Row {
  student: Student
  attempts: Submission[]
  grade: Grade | null
  state: State
}

function stateOf(attempts: Submission[], grade: Grade | null, deadline: string): State {
  const latest = attempts[0]
  if (grade?.returned_at && (!latest || new Date(grade.graded_at) >= new Date(latest.submitted_at))) return 'returned'
  if (latest) return grade && new Date(grade.graded_at) >= new Date(latest.submitted_at) ? 'draft' : 'to_grade'
  if (grade) return grade.returned_at ? 'returned' : 'draft'
  return isOverdue(deadline) ? 'missing' : 'not_submitted'
}

function StatePill({ row }: { row: Row }) {
  const late = row.attempts[0]?.is_late
  switch (row.state) {
    case 'returned': return <Pill tone="completed">Returned</Pill>
    case 'draft': return <Pill tone="neutral">Draft grade</Pill>
    case 'to_grade': return late ? <Pill tone="changed">Late · to grade</Pill> : <Pill tone="in_progress">To grade</Pill>
    case 'missing': return <Pill tone="overdue">Missing</Pill>
    default: return <Pill tone="pending">Not submitted</Pill>
  }
}

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function SubmissionsReview({ assignment }: { assignment: Assignment }) {
  const [students, setStudents] = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [e, s, g] = await Promise.all([
      supabase.from('enrollments').select('profiles(id, full_name, email)').eq('course_id', assignment.course_id),
      loadSubmissions(assignment.id),
      loadGrades(assignment.id),
    ])
    const list = ((e.data ?? []) as unknown as { profiles: Student | null }[]).flatMap((r) => (r.profiles ? [r.profiles] : []))
    list.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email))
    setStudents(list)
    setSubmissions(s)
    setGrades(g)
    setLoading(false)
  }, [assignment.course_id, assignment.id])

  useEffect(() => {
    void load()
  }, [load])

  const rows: Row[] = useMemo(
    () =>
      students.map((student) => {
        const attempts = submissions.filter((s) => s.student_id === student.id)
        const grade = grades.find((g) => g.student_id === student.id) ?? null
        return { student, attempts, grade, state: stateOf(attempts, grade, assignment.current_deadline) }
      }),
    [students, submissions, grades, assignment.current_deadline],
  )

  const submitted = rows.filter((r) => r.attempts.length > 0).length
  const late = rows.filter((r) => r.attempts[0]?.is_late).length
  const toGrade = rows.filter((r) => r.state === 'to_grade').length
  const returned = rows.filter((r) => r.state === 'returned').length
  const missing = rows.filter((r) => r.state === 'missing').length
  const shown = rows.filter((r) =>
    filter === 'all' ? true
    : filter === 'to_grade' ? r.state === 'to_grade' || r.state === 'draft'
    : filter === 'missing' ? r.state === 'missing' || r.state === 'not_submitted'
    : r.state === 'returned',
  )

  function exportCsv() {
    const head = ['Name', 'Email', 'Status', 'Submitted at', 'Late', 'Attempts', 'Marks', 'Out of', 'Returned']
    const lines = rows.map((r) => [
      r.student.full_name, r.student.email, r.state.replace('_', ' '),
      r.attempts[0] ? new Date(r.attempts[0].submitted_at).toISOString() : '',
      r.attempts[0]?.is_late ? 'yes' : r.attempts[0] ? 'no' : '',
      r.attempts.length, r.grade ? formatMarks(r.grade.marks) : '', assignment.total_marks,
      r.grade?.returned_at ? 'yes' : 'no',
    ].map(csvCell).join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${assignment.title.replace(/[^A-Za-z0-9]+/g, '-')}-grades.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <Card className="rise !p-0" style={{ ['--i' as string]: 2 }}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-5">
        <div>
          <h2 className="text-lg font-semibold">Submissions</h2>
          <p className="mt-1 text-sm text-slate-500">Marked out of {assignment.total_marks}. Grades stay private until you return them.</p>
        </div>
        <button className={btnGhost} onClick={exportCsv} disabled={rows.length === 0}><Download size={15} /> Export CSV</button>
      </div>

      <dl className="grid grid-cols-2 gap-px border-y border-slate-100 bg-slate-100 sm:grid-cols-5">
        {[
          ['Submitted', `${submitted}/${rows.length}`],
          ['To grade', toGrade],
          ['Returned', returned],
          ['Late', late],
          ['Missing', missing],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-5 py-3">
            <dt className={label}>{k}</dt>
            <dd className="tnum mt-0.5 text-xl font-semibold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="px-6 py-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'to_grade', label: 'To grade' }, { value: 'missing', label: 'Not submitted' }, { value: 'graded', label: 'Returned' }]}
        />
      </div>

      {loading ? (
        <p className="px-6 pb-6 text-sm text-slate-500">Loading submissions…</p>
      ) : rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-slate-500">No students are enrolled yet. Share the course's enrollment code.</p>
      ) : shown.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-slate-500">Nobody in this group.</p>
      ) : (
        <ul className="border-t border-slate-100">
          {shown.map((r) => {
            const open = openId === r.student.id
            const latest = r.attempts[0]
            return (
              <li key={r.student.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3.5 text-left hover:bg-slate-50/70"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : r.student.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{r.student.full_name || r.student.email}</span>
                    <span className="block truncate text-xs text-slate-500">{r.student.email}</span>
                  </span>
                  <span className="tnum hidden w-36 font-mono text-[11px] text-slate-500 sm:block">
                    {latest ? formatStamp(latest.submitted_at) : '—'}
                    {r.attempts.length > 1 && <span className="block">{r.attempts.length} attempts</span>}
                  </span>
                  <span className="tnum w-16 text-right text-sm font-semibold text-slate-800">
                    {r.grade ? `${formatMarks(r.grade.marks)}/${assignment.total_marks}` : ''}
                  </span>
                  <span className="w-32 text-right"><StatePill row={r} /></span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {open && <GradePanel assignment={assignment} row={r} onSaved={load} />}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function GradePanel({ assignment, row, onSaved }: { assignment: Assignment; row: Row; onSaved: () => void }) {
  const [marks, setMarks] = useState(row.grade ? formatMarks(row.grade.marks) : '')
  const [feedback, setFeedback] = useState(row.grade?.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save(returnToStudent: boolean) {
    setError(null)
    setSaved(null)
    const value = Number(marks)
    if (marks.trim() === '' || Number.isNaN(value)) return setError('Enter the marks.')
    if (value < 0 || value > assignment.total_marks) return setError(`Marks must be between 0 and ${assignment.total_marks}.`)
    if (returnToStudent && row.attempts.length === 0 && !window.confirm('This student has not submitted anything. Return this grade anyway?')) return
    setBusy(true)
    const { error } = await gradeWork(assignment.id, row.student.id, value, feedback, returnToStudent)
    setBusy(false)
    if (error) return setError(error.message)
    setSaved(returnToStudent ? 'Returned. The student has been notified.' : 'Saved as a draft. The student cannot see it yet.')
    onSaved()
  }

  return (
    <div className="fade grid gap-6 bg-slate-50/60 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        {row.attempts.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing submitted yet.</p>
        ) : (
          <ol className="space-y-3">
            {row.attempts.map((s, i) => <AttemptCard key={s.id} submission={s} open={i === 0} />)}
          </ol>
        )}
      </div>
      <div className="space-y-3">
        <div className={label}>Grade {row.attempts[0] ? `attempt ${row.attempts[0].attempt}` : ''}</div>
        <label className="block text-sm font-medium text-slate-700">
          Marks <span className="font-normal text-slate-400">out of {assignment.total_marks}</span>
          <input className={`${input} mt-1.5`} type="number" min={0} max={assignment.total_marks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} disabled={busy} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Feedback
          <textarea className={`${input} mt-1.5`} rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what to improve…" disabled={busy} />
        </label>
        <ErrorText message={error} />
        {saved && <p role="status" className="text-sm font-medium text-emerald-700">{saved}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => void save(true)} disabled={busy}>{row.grade?.returned_at ? 'Update and return' : 'Return to student'}</button>
          {!row.grade?.returned_at && <button className={btnGhost} onClick={() => void save(false)} disabled={busy}>Save draft</button>}
        </div>
        {row.grade?.returned_at && <p className="font-mono text-[11px] text-slate-500">Returned {formatStamp(row.grade.returned_at)}</p>}
      </div>
    </div>
  )
}
