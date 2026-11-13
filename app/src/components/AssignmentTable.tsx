import { ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDay, formatShort, relativeLabel } from '../lib/dates'
import type { DeadlineChange, Role } from '../lib/types'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import { isHandedIn, nextStep, type ClassWork, type WorkInfo } from '../lib/workStatus'
import { CourseDot, Pill, WorkPill } from './ui'

interface Props {
  rows: AssignmentWithCourse[]
  changed: Record<string, DeadlineChange>
  role: Role
  /** Student: their own status per assignment. */
  work?: Record<string, WorkInfo>
  /** Instructor: class summary per assignment. */
  classWork?: Record<string, ClassWork>
  /** Student: mark an assignment as started. */
  onStart?: (a: AssignmentWithCourse) => void
  empty?: string
}

const COLS = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_9rem] md:items-center md:gap-4'
const action =
  'tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 ring-1 ring-inset ring-transparent hover:bg-white hover:text-slate-900 hover:ring-slate-200'

export default function AssignmentTable({ rows, changed, role, work = {}, classWork = {}, onStart, empty = 'Nothing here.' }: Props) {
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-sm text-slate-500">{empty}</p>

  return (
    <div>
      <div className={`hidden border-y border-slate-100 bg-slate-50/70 px-6 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 ${COLS}`}>
        <span>Assignment</span>
        <span>Deadline</span>
        <span>{role === 'student' ? 'Status' : 'Submissions'}</span>
        <span />
      </div>
      <ul>
        {rows.map((a) => {
          const w = work[a.id]
          const cw = classWork[a.id]
          const rel = relativeLabel(a.current_deadline)
          const change = changed[a.id]
          const urgent = role === 'student' && rel.overdue && w?.state === 'missing'
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
                  <div className={`mt-0.5 font-mono text-[11px] ${urgent ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                    {(role === 'instructor' || isHandedIn(w?.state)) && rel.overdue ? 'closed' : rel.text}
                  </div>
                )}
              </div>
              <div>
                {role === 'student' && w ? (
                  <WorkPill work={w} />
                ) : role === 'instructor' && cw ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="tnum font-medium text-slate-800">{cw.submitted}/{cw.enrolled}</span>
                    <span className="text-slate-500">submitted</span>
                    {cw.toGrade > 0 && <Pill tone="in_progress">{cw.toGrade} to grade</Pill>}
                  </div>
                ) : null}
              </div>
              <div className="md:text-right">
                {role === 'student' && w ? (
                  w.state === 'not_started' && onStart ? (
                    <button className={action} onClick={() => onStart(a)}>I've started</button>
                  ) : (
                    <Link to={`/assignments/${a.id}`} className={action}>{nextStep(w.state)} <ChevronRight size={14} aria-hidden="true" /></Link>
                  )
                ) : role === 'instructor' ? (
                  <Link to={`/assignments/${a.id}`} className={action}>{cw && cw.toGrade > 0 ? 'Grade' : 'Manage'} <ChevronRight size={14} aria-hidden="true" /></Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
