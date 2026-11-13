import { formatStamp } from '../lib/dates'
import { formatMarks, isHandedIn, type WorkInfo } from '../lib/workStatus'

/** Assigned → Started → Submitted → Graded, filled in from real data. */
export default function WorkSteps({ work }: { work: WorkInfo }) {
  const handedIn = isHandedIn(work.state)
  const late = work.state === 'submitted_late'
  const missing = work.state === 'missing' || work.state === 'closed'
  const steps = [
    { label: 'Assigned', done: true, at: null as string | null, bar: 'bg-indigo-500' },
    { label: 'Started', done: work.state === 'in_progress' || handedIn, at: null, bar: 'bg-indigo-500' },
    {
      label: missing ? (work.state === 'closed' ? 'Not submitted' : 'Missing') : late ? 'Submitted late' : 'Submitted',
      done: handedIn || missing,
      at: work.submittedAt,
      bar: missing ? 'bg-rose-400' : late ? 'bg-orange-400' : 'bg-indigo-500',
    },
    {
      label: work.state === 'graded' && work.marks !== null ? `Graded · ${formatMarks(work.marks)}/${work.total}` : 'Graded',
      done: work.state === 'graded',
      at: work.gradedAt,
      bar: 'bg-emerald-500',
    },
  ]
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
      {steps.map((s) => (
        <li key={s.label} className="min-w-0">
          <div className={`h-1.5 rounded-full ${s.done ? s.bar : 'bg-slate-200'}`} />
          <div className={`mt-2 truncate text-xs font-semibold ${s.done ? (s.bar === 'bg-rose-400' ? 'text-rose-700' : 'text-slate-800') : 'text-slate-400'}`}>{s.label}</div>
          {s.at && <div className="tnum truncate font-mono text-[11px] text-slate-500">{formatStamp(s.at)}</div>}
        </li>
      ))}
    </ol>
  )
}
