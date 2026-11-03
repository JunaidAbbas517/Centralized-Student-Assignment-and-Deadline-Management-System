import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Assignment, AssignmentProgress, DeadlineChange, ProgressStatus } from './types'

export type AssignmentWithCourse = Assignment & { courses: { name: string; course_code: string } | null }

/**
 * Loads the assignments visible to the current user (RLS does the filtering),
 * the student's own progress, and the latest deadline change per assignment.
 */
export function useAssignments(role: 'student' | 'instructor') {
  const [assignments, setAssignments] = useState<AssignmentWithCourse[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({})
  const [changed, setChanged] = useState<Record<string, DeadlineChange>>({})
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
    setAssignments((a.data ?? []) as AssignmentWithCourse[])

    const c = await supabase.from('deadline_changes').select('*').order('changed_at', { ascending: false })
    const latest: Record<string, DeadlineChange> = {}
    for (const row of (c.data ?? []) as DeadlineChange[]) latest[row.assignment_id] ??= row
    setChanged(latest)

    if (role === 'student') {
      const p = await supabase.from('assignment_progress').select('*')
      const map: Record<string, ProgressStatus> = {}
      for (const row of (p.data ?? []) as AssignmentProgress[]) map[row.assignment_id] = row.status
      setProgress(map)
    }
    setError(null)
    setLoading(false)
  }, [role])

  useEffect(() => {
    void reload()
  }, [reload])

  return { assignments, progress, changed, loading, error, reload }
}
