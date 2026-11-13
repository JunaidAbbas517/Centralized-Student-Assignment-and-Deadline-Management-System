import { useCallback, useEffect, useState } from 'react'
import { registerCourses } from '../components/ui'
import { supabase } from './supabase'
import type { Assignment, AssignmentProgress, DeadlineChange, ProgressStatus } from './types'
import { deriveWork, type ClassWork, type LatestSubmission, type ReturnedGrade, type WorkInfo } from './workStatus'

export type AssignmentWithCourse = Assignment & { courses: { name: string; course_code: string } | null }

/**
 * Loads the assignments visible to the current user (RLS does the filtering),
 * deadline changes, a map of user names, and where the work stands:
 * the student's own status per assignment, or the class summary for an instructor.
 */
export function useAssignments(role: 'student' | 'instructor') {
  const [assignments, setAssignments] = useState<AssignmentWithCourse[]>([])
  const [work, setWork] = useState<Record<string, WorkInfo>>({})
  const [classWork, setClassWork] = useState<Record<string, ClassWork>>({})
  const [changed, setChanged] = useState<Record<string, DeadlineChange>>({})
  const [history, setHistory] = useState<Record<string, DeadlineChange[]>>({})
  const [people, setPeople] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const a = await supabase
      .from('assignments')
      .select('*, courses(name, course_code)')
      .order('current_deadline')
    if (a.error) {
      setError(a.error.message)
      setLoading(false)
      return
    }
    const rows = (a.data ?? []) as AssignmentWithCourse[]

    // Fix course colour order (by course code) before anything renders.
    const codes = new Map<string, string>()
    for (const r of rows) codes.set(r.course_id, r.courses?.course_code ?? '')
    registerCourses([...codes.entries()].sort((x, y) => x[1].localeCompare(y[1])).map(([id]) => id))
    setAssignments(rows)

    const c = await supabase.from('deadline_changes').select('*').order('changed_at', { ascending: false })
    const latest: Record<string, DeadlineChange> = {}
    const all: Record<string, DeadlineChange[]> = {}
    for (const row of (c.data ?? []) as DeadlineChange[]) {
      ;(all[row.assignment_id] ??= []).push(row)
      latest[row.assignment_id] ??= row
    }
    setChanged(latest)
    setHistory(all)

    const pr = await supabase.from('profiles').select('id, full_name')
    const names: Record<string, string> = {}
    for (const p of (pr.data ?? []) as { id: string; full_name: string }[]) names[p.id] = p.full_name
    setPeople(names)

    if (role === 'student') setWork(await loadStudentWork(rows))
    else setClassWork(await loadClassWork(rows))
    setError(null)
    setLoading(false)
  }, [role])

  useEffect(() => {
    void reload()
  }, [reload])

  return { assignments, work, classWork, changed, history, people, loading, error, reload }
}

async function loadStudentWork(rows: AssignmentWithCourse[]): Promise<Record<string, WorkInfo>> {
  const [p, s, g] = await Promise.all([
    supabase.from('assignment_progress').select('*'),
    supabase.from('submissions').select('assignment_id, attempt, is_late, submitted_at'),
    supabase.from('grades').select('assignment_id, marks, returned_at'),
  ])
  const progress: Record<string, ProgressStatus> = {}
  for (const row of (p.data ?? []) as AssignmentProgress[]) progress[row.assignment_id] = row.status
  const latest: Record<string, LatestSubmission> = {}
  for (const row of (s.data ?? []) as (LatestSubmission & { assignment_id: string })[]) {
    if (!latest[row.assignment_id] || row.attempt > latest[row.assignment_id].attempt) latest[row.assignment_id] = row
  }
  // Students only receive grades that have been returned (RLS).
  const grades: Record<string, ReturnedGrade> = {}
  for (const row of (g.data ?? []) as (ReturnedGrade & { assignment_id: string })[]) {
    if (row.returned_at) grades[row.assignment_id] = row
  }

  const out: Record<string, WorkInfo> = {}
  for (const a of rows) out[a.id] = deriveWork(a, progress[a.id], latest[a.id], grades[a.id])
  return out
}

async function loadClassWork(rows: AssignmentWithCourse[]): Promise<Record<string, ClassWork>> {
  const [e, s, g] = await Promise.all([
    supabase.from('enrollments').select('course_id'),
    supabase.from('submissions').select('assignment_id, student_id'),
    supabase.from('grades').select('assignment_id, student_id, returned_at'),
  ])
  const enrolled: Record<string, number> = {}
  for (const r of (e.data ?? []) as { course_id: string }[]) enrolled[r.course_id] = (enrolled[r.course_id] ?? 0) + 1
  const submitters: Record<string, Set<string>> = {}
  for (const r of (s.data ?? []) as { assignment_id: string; student_id: string }[]) (submitters[r.assignment_id] ??= new Set()).add(r.student_id)
  const returned: Record<string, Set<string>> = {}
  for (const r of (g.data ?? []) as { assignment_id: string; student_id: string; returned_at: string | null }[]) {
    if (r.returned_at) (returned[r.assignment_id] ??= new Set()).add(r.student_id)
  }

  const out: Record<string, ClassWork> = {}
  for (const a of rows) {
    const sub = submitters[a.id] ?? new Set<string>()
    const ret = returned[a.id] ?? new Set<string>()
    out[a.id] = {
      enrolled: enrolled[a.course_id] ?? 0,
      submitted: sub.size,
      returned: ret.size,
      toGrade: [...sub].filter((id) => !ret.has(id)).length,
    }
  }
  return out
}
