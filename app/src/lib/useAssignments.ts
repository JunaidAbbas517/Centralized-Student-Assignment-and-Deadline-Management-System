import { useCallback, useEffect, useState } from 'react'
import { registerCourses } from '../components/ui'
import { supabase } from './supabase'
import type { Assignment, AssignmentProgress, DeadlineChange, ProgressStatus } from './types'

export type AssignmentWithCourse = Assignment & { courses: { name: string; course_code: string } | null }

/**
 * Loads the assignments visible to the current user (RLS does the filtering),
 * the student's own progress, deadline changes, and a map of user names.
 */
export function useAssignments(role: 'student' | 'instructor') {
  const [assignments, setAssignments] = useState<AssignmentWithCourse[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({})
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

  return { assignments, progress, changed, history, people, loading, error, reload }
}
