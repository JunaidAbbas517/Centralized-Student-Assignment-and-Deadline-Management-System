import { Link } from 'react-router-dom'
import { formatDateTime, isDueSoon, isOverdue } from '../lib/dates'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import type { ProgressStatus } from '../lib/types'
import { courseColor, StatusBadge } from './ui'

interface Props {
  assignment: AssignmentWithCourse
  status?: ProgressStatus
  changed?: boolean
}

export default function AssignmentRow({ assignment, status, changed }: Props) {
  const done = status === 'completed'
  const overdue = !done && isOverdue(assignment.current_deadline)
  const soon = !done && isDueSoon(assignment.current_deadline)
  return (
    <li>
      <Link
        to={`/assignments/${assignment.id}`}
        className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
      >
        <span className={`rounded border px-1.5 text-xs ${courseColor(assignment.course_id)}`}>
          {assignment.courses?.course_code}
        </span>
        <span className="font-medium">{assignment.title}</span>
        {changed && (
          <span className="rounded bg-red-100 px-1.5 text-xs text-red-700" title="Deadline was changed">
            ● Deadline changed
          </span>
        )}
        {soon && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">Due soon</span>}
        {overdue && <span className="rounded bg-red-600 px-1.5 text-xs text-white">Overdue</span>}
        <span className="ml-auto text-sm text-slate-600">{formatDateTime(assignment.current_deadline)}</span>
        {status && <StatusBadge status={status} />}
      </Link>
    </li>
  )
}
