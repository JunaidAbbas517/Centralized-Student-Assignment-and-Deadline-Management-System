import type { Assignment, ProgressStatus } from './types'

/** Where a student's work on one assignment stands. Derived from real data, never set by a click. */
export type WorkState = 'not_started' | 'in_progress' | 'submitted' | 'submitted_late' | 'graded' | 'missing' | 'closed'

export interface WorkInfo {
  state: WorkState
  attempts: number
  submittedAt: string | null
  /** Only present once the instructor has returned the grade. */
  marks: number | null
  gradedAt: string | null
  total: number
}

export interface ReturnedGrade { marks: number; returned_at: string }

export const WORK_LABEL: Record<WorkState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  submitted_late: 'Submitted late',
  graded: 'Graded',
  missing: 'Missing',
  closed: 'Closed',
}

export interface LatestSubmission { attempt: number; is_late: boolean; submitted_at: string }

export function deriveWork(
  assignment: Pick<Assignment, 'current_deadline' | 'allow_late' | 'total_marks'>,
  progress: ProgressStatus | undefined,
  latest: LatestSubmission | undefined,
  grade: ReturnedGrade | undefined,
  now: Date = new Date(),
): WorkInfo {
  const base = {
    attempts: latest?.attempt ?? 0,
    submittedAt: latest?.submitted_at ?? null,
    marks: grade ? Number(grade.marks) : null,
    gradedAt: grade?.returned_at ?? null,
    total: assignment.total_marks,
  }
  if (grade) return { ...base, state: 'graded' }
  if (latest) return { ...base, state: latest.is_late ? 'submitted_late' : 'submitted' }
  const past = now.getTime() > new Date(assignment.current_deadline).getTime()
  if (past) return { ...base, state: assignment.allow_late ? 'missing' : 'closed' }
  return { ...base, state: progress === 'in_progress' ? 'in_progress' : 'not_started' }
}

/** Handed in (or graded): nothing left for the student to do. */
export function isHandedIn(state: WorkState | undefined): boolean {
  return state === 'submitted' || state === 'submitted_late' || state === 'graded'
}

/** The student can still act on it. */
export function isOpen(state: WorkState | undefined): boolean {
  return state === 'not_started' || state === 'in_progress' || state === 'missing'
}

/** Label for the student's main action on the assignment. */
export function nextStep(state: WorkState): string {
  switch (state) {
    case 'not_started':
    case 'in_progress': return 'Submit work'
    case 'missing': return 'Submit late'
    case 'graded': return 'View grade'
    case 'closed': return 'View'
    default: return 'View submission'
  }
}

export function formatMarks(marks: number): string {
  return Number.isInteger(marks) ? String(marks) : marks.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** Per-assignment class summary for instructors. */
export interface ClassWork { enrolled: number; submitted: number; toGrade: number; returned: number }
