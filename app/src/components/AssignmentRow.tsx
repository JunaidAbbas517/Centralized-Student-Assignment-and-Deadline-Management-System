import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatShort, isOverdue, relativeLabel } from '../lib/dates'
import type { ProgressStatus } from '../lib/types'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import { CourseDot, Pill, StatusBadge } from './ui'

interface Props {
  assignment: AssignmentWithCourse
  status?: ProgressStatus
  changed?: boolean
}

/** Compact row used on the course page. */
export default function AssignmentRow({ assignment, status, changed }: Props) {
  const overdue = status !== 'completed' && isOverdue(assignment.current_deadline)
  const rel = relativeLabel(assignment.current_deadline)
  return (
    <li>
      <Link
        to={`/assignments/${assignment.id}`}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
      >
        <CourseDot courseId={assignment.course_id} />
        <span className="font-semibold">{assignment.title}</span>
        {changed && (
          <Pill tone="changed"><RefreshCw size={11} /> Deadline changed</Pill>
        )}
        <span className="ml-auto text-sm text-slate-600">
          {formatShort(assignment.current_deadline)}
          <span className={`ml-2 text-xs ${rel.overdue && overdue ? 'font-medium text-red-700' : 'text-slate-500'}`}>{rel.text}</span>
        </span>
        {status && (overdue ? <Pill tone="overdue">Overdue</Pill> : <StatusBadge status={status} />)}
      </Link>
    </li>
  )
}
