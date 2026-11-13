import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AccountStatus, Profile } from '../../lib/types'

export interface CourseSummary {
  id: string
  name: string
  course_code: string
  archived: boolean
  instructor: string
  students: number
  assignments: number
}

export interface AdminStats {
  students: number
  instructors: number
  pending: number
  rejected: number
  courses: number
  archived_courses: number
  assignments: number
  upcoming: number
  enrollments: number
  deadline_changes: number
  new_users_7d: number
  completed: number
  course_list: CourseSummary[]
}

/** Everything the admin pages show: platform figures and every account. */
export function useAdminData() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.rpc('admin_stats'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ])
    setError(s.error?.message ?? p.error?.message ?? null)
    if (s.data) setStats(s.data as AdminStats)
    setPeople((p.data ?? []) as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { stats, people, error, loading, reload }
}

export async function setInstructorStatus(userId: string, status: AccountStatus) {
  const { error } = await supabase.rpc('set_instructor_status', { p_user: userId, p_status: status })
  if (!error) window.dispatchEvent(new Event('admin-changed'))
  return error?.message ?? null
}

export function initials(name: string): string {
  return name.split(/\s+/).filter((p) => p && !p.endsWith('.')).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}
