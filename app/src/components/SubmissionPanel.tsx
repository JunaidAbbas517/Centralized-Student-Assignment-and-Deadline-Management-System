import { useState, type FormEvent } from 'react'
import { CircleCheck, Clock, Link2, Send, TriangleAlert } from 'lucide-react'
import FilePicker from './FilePicker'
import StoredFiles from './StoredFiles'
import WorkSteps from './WorkSteps'
import { btn, Card, ErrorText, input, label, Pill, WorkPill } from './ui'
import { formatStamp } from '../lib/dates'
import { isValidLink, SUBMISSION_BUCKET, validateFiles } from '../lib/files'
import { formatMarks, submissionWindow, submitWork } from '../lib/submissions'
import { notifyNotificationsChanged } from '../lib/progress'
import type { Assignment, Grade, Submission } from '../lib/types'
import { deriveWork } from '../lib/workStatus'

interface Props {
  assignment: Assignment
  studentId: string
  submissions: Submission[]
  grade: Grade | null
  started: boolean
  onToggleStarted: (started: boolean) => void
  onSubmitted: () => void
}

export default function SubmissionPanel({ assignment, studentId, submissions, grade, started, onToggleStarted, onSubmitted }: Props) {
  const latest = submissions[0]
  const status = submissionWindow(assignment, submissions.length, Boolean(grade))
  const takesFiles = assignment.submission_type !== 'link'
  const takesLink = assignment.submission_type !== 'file'
  const work = deriveWork(assignment, started ? 'in_progress' : 'pending', latest, grade?.returned_at ? { marks: grade.marks, returned_at: grade.returned_at } : undefined)
  const canToggle = work.state === 'not_started' || work.state === 'in_progress'

  return (
    <Card className="rise" style={{ ['--i' as string]: 2 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your submission</h2>
          <p className="mt-1 text-sm text-slate-500">Only you, your instructor and the school admin can see it.</p>
        </div>
        <WorkPill work={work} />
      </div>

      <WorkSteps work={work} />

      {canToggle && (
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
            checked={started}
            onChange={(e) => onToggleStarted(e.target.checked)}
          />
          I've started working on this
        </label>
      )}

      {grade && <GradeBox grade={grade} total={assignment.total_marks} />}

      {status.open ? (
        <SubmitForm
          assignment={assignment}
          studentId={studentId}
          attempt={submissions.length + 1}
          late={status.late}
          takesFiles={takesFiles}
          takesLink={takesLink}
          onSubmitted={onSubmitted}
        />
      ) : (
        status.reason && !grade && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
            <Clock size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {status.reason}
          </p>
        )
      )}

      {submissions.length > 0 && (
        <div className="mt-7">
          <div className={`${label} mb-3`}>{submissions.length === 1 ? 'What you submitted' : `Your ${submissions.length} attempts`}</div>
          <ol className="space-y-3">
            {submissions.map((s) => (
              <AttemptCard key={s.id} submission={s} open={s.id === latest?.id} graded={grade?.submission_id === s.id} />
            ))}
          </ol>
        </div>
      )}
    </Card>
  )
}

function GradeBox({ grade, total }: { grade: Grade; total: number }) {
  const pct = Math.round((grade.marks / total) * 100)
  return (
    <div className="mt-6 rounded-2xl bg-emerald-50/70 p-5 ring-1 ring-inset ring-emerald-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className={`${label} !text-emerald-800`}>Your grade</div>
        {grade.returned_at && <div className="font-mono text-[11px] text-emerald-800">Returned {formatStamp(grade.returned_at)}</div>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="tnum font-display text-3xl font-semibold text-emerald-900">{formatMarks(grade.marks)}</span>
        <span className="text-lg text-emerald-800">/ {total}</span>
        <span className="tnum ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">{pct}%</span>
      </div>
      {grade.feedback && (
        <div className="mt-4">
          <div className={`${label} !text-emerald-800`}>Feedback</div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{grade.feedback}</p>
        </div>
      )}
    </div>
  )
}

function SubmitForm({
  assignment, studentId, attempt, late, takesFiles, takesLink, onSubmitted,
}: {
  assignment: Assignment
  studentId: string
  attempt: number
  late: boolean
  takesFiles: boolean
  takesLink: boolean
  onSubmitted: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [link, setLink] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(null)
    if (takesFiles && files.length === 0) return setError('Attach at least one file.')
    if (takesLink && !link.trim()) return setError('Add the link to your work.')
    if (link.trim() && !isValidLink(link)) return setError('The link must start with http:// or https://')
    if (assignment.summary_required && !summary.trim()) return setError('Write a short summary of your work.')
    const fileProblem = validateFiles(files, assignment)
    if (fileProblem) return setError(fileProblem)
    if (attempt > 1 && !window.confirm(`Submit attempt ${attempt}? Your instructor will grade this latest attempt. Earlier attempts stay in your history.`)) return

    setBusy(true)
    const err = await submitWork(assignment, studentId, files, summary, link)
    setBusy(false)
    if (err) return setError(err)
    setFiles([])
    setLink('')
    setSummary('')
    setDone(`${late ? 'Submitted late' : 'Submitted on time'} at ${formatStamp(new Date().toISOString())}.`)
    notifyNotificationsChanged()
    onSubmitted()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{attempt === 1 ? 'Hand in your work' : `Resubmit (attempt ${attempt})`}</h3>
        {late && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
            <TriangleAlert size={13} aria-hidden="true" /> The deadline has passed. This will be marked late.
          </span>
        )}
      </div>

      {takesFiles && (
        <FilePicker
          files={files}
          onChange={setFiles}
          allowedExtensions={assignment.allowed_extensions}
          maxFileMb={assignment.max_file_mb}
          maxFiles={assignment.max_files}
          disabled={busy}
        />
      )}

      {takesLink && (
        <label className="block text-sm font-medium text-slate-700">
          Link to your work
          <input className={`${input} mt-1.5`} type="url" inputMode="url" placeholder="https://github.com/you/project" value={link} onChange={(e) => setLink(e.target.value)} disabled={busy} />
        </label>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Summary {!assignment.summary_required && <span className="font-normal text-slate-400">(optional)</span>}
        <textarea
          className={`${input} mt-1.5`}
          rows={3}
          maxLength={2000}
          placeholder="What you did, anything your instructor should know…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={busy}
        />
      </label>

      <ErrorText message={error} />
      {done && <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CircleCheck size={15} /> {done}</p>}
      <button className={btn} disabled={busy}>
        <Send size={15} /> {busy ? 'Uploading…' : attempt === 1 ? 'Submit' : 'Resubmit'}
      </button>
    </form>
  )
}

export function AttemptCard({ submission, open, graded }: { submission: Submission; open: boolean; graded?: boolean }) {
  return (
    <li>
      <details open={open} className="group rounded-2xl bg-slate-50/70 ring-1 ring-inset ring-slate-200/80">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-900">Attempt {submission.attempt}</span>
          <span className="tnum font-mono text-[11px] text-slate-500">{formatStamp(submission.submitted_at)}</span>
          {submission.is_late ? <Pill tone="changed">Late</Pill> : <Pill tone="completed">On time</Pill>}
          {graded && <Pill tone="neutral">Graded</Pill>}
          <span className="ml-auto text-xs text-slate-400 group-open:hidden">Show</span>
        </summary>
        <div className="space-y-3 border-t border-slate-200/70 px-4 py-3">
          {submission.summary && (
            <div>
              <div className={label}>Summary</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{submission.summary}</p>
            </div>
          )}
          {submission.link && (
            <a href={submission.link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline">
              <Link2 size={14} className="shrink-0" /> <span className="truncate">{submission.link}</span>
            </a>
          )}
          <StoredFiles bucket={SUBMISSION_BUCKET} files={submission.submission_files} />
          {!submission.summary && !submission.link && submission.submission_files.length === 0 && (
            <p className="text-sm text-slate-500">Nothing attached.</p>
          )}
        </div>
      </details>
    </li>
  )
}
