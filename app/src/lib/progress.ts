import { supabase } from './supabase'
import type { ProgressStatus } from './types'

export function saveProgress(studentId: string, assignmentId: string, status: ProgressStatus) {
  return supabase
    .from('assignment_progress')
    .upsert(
      { student_id: studentId, assignment_id: assignmentId, status, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,assignment_id' },
    )
}

/** Tells the sidebar to refresh its unread badge. */
export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event('notifications-changed'))
}
