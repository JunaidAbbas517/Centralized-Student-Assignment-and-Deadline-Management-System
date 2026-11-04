import { ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDay, formatShort, isOverdue, relativeLabel } from '../lib/dates'
import type { DeadlineChange, ProgressStatus, Role } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import { CourseDot, Pill, StatusMenu } from './ui'

interface Props {
  rows: AssignmentWithCourse[]
  progress: Record<string, ProgressStatus>
  changed: Record<string, DeadlineChange>
  role: Role
  onStatus?: (a: AssignmentWithCourse, s: ProgressStatus) => void
  empty?: string
}

const COLS = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_9rem] md:items-center md:gap-4'

export default function AssignmentTable({ rows, progress, changed, role, onStatus, empty = 'Nothing here.' }: Props) {
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-sm text-slate-500">{empty}</p>

  return (
    <div>
      <div className={`hidden border-y border-slate-100 bg-slate-50/70 px-6 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 ${COLS}`}>
        <span>Assignment</span>
        <span>Deadline</span>
        <span>{role === 'student' ? 'Status' : ''}</span>
        <span />
      </div>
      <ul>
        {rows.map((a) => {
          const status = progress[a.id] ?? 'pending'
          const overdue = status !== 'completed' && isOverdue(a.current_deadline)
          const rel = relativeLabel(a.current_deadline)
          const change = changed[a.id]
          return (
            <li key={a.id} className={`flex flex-col gap-2 border-b border-slate-100 px-6 py-4 last:border-b-0 hover:bg-slate-50/60 ${COLS}`}>
              <div className="min-w-0">
                <Link to={`/assignments/${a.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                  {a.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <CourseDot courseId={a.course_id} />
                  <span className="truncate">{a.courses?.name}</span>
                </div>
              </div>
              <div className="text-sm">
                <div className="tnum font-medium text-slate-800">{formatShort(a.current_deadline)}</div>
                {change ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                    <RefreshCw size={11} /> Changed from {formatDay(change.previous_deadline)}
                  </span>
                ) : (
                  <div className={`mt-0.5 font-mono text-[11px] ${rel.overdue && status !== 'completed' && role === 'student' ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                    {role === 'instructor' && rel.overdue ? 'closed' : rel.text}
                  </div>
                )}
              </div>
              <div>
                {role === 'student' ? (
                  overdue ? <Pill tone="overdue">Overdue</Pill> : <Pill tone={status}>{STATUS_LABEL[status]}</Pill>
                ) : null}
              </div>
              <div className="md:text-right">
                {role === 'student' && onStatus ? (
                  <StatusMenu value={status} onChange={(s) => onStatus(a, s)} />
                ) : role === 'instructor' ? (
                  <Link to={`/assignments/${a.id}`} className="tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 ring-1 ring-inset ring-transparent hover:bg-white hover:text-slate-900 hover:ring-slate-200">Manage <ChevronRight size={14} aria-hidden="true" /></Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
