import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDay, formatShort, isOverdue, relativeLabel } from '../lib/dates'
import type { DeadlineChange, ProgressStatus, Role } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import { btnGhost, CourseDot, Pill, StatusMenu } from './ui'

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
      <div className={`hidden border-y border-slate-100 bg-slate-50/60 px-5 py-2 text-xs font-semibold text-slate-500 ${COLS}`}>
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
            <li key={a.id} className={`flex flex-col gap-2 border-b border-slate-100 px-5 py-3.5 last:border-b-0 ${COLS}`}>
              <div className="min-w-0">
                <Link to={`/assignments/${a.id}`} className="font-semibold hover:text-indigo-700">
                  {a.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <CourseDot courseId={a.course_id} />
                  <span className="truncate">{a.courses?.name}</span>
                </div>
              </div>
              <div className="text-sm">
                <div>{formatShort(a.current_deadline)}</div>
                {change ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                    <RefreshCw size={11} /> Changed from {formatDay(change.previous_deadline)}
                  </span>
                ) : (
                  <div className={`text-xs ${rel.overdue && status !== 'completed' ? 'font-medium text-red-700' : 'text-slate-500'}`}>
                    {rel.text}
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
                  <Link to={`/assignments/${a.id}`} className={btnGhost}>Manage</Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
