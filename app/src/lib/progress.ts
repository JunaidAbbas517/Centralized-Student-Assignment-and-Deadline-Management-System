import { supabase } from './supabase'

/**
 * The one status a student sets by hand: "I've started" (or undo it).
 * Submitted and graded come only from real submissions and grades.
 */
export function setStarted(studentId: string, assignmentId: string, started: boolean) {
  return supabase
    .from('assignment_progress')
    .upsert(
      { student_id: studentId, assignment_id: assignmentId, status: started ? 'in_progress' : 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'student_id,assignment_id' },
    )
}

/** Tells the sidebar to refresh its unread badge. */
export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event('notifications-changed'))
}
