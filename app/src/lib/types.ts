export type Role = 'student' | 'instructor'
export type ProgressStatus = 'pending' | 'in_progress' | 'completed'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
}

export interface Course {
  id: string
  instructor_id: string
  name: string
  course_code: string
  enrollment_code: string
  archived: boolean
}

export interface Assignment {
  id: string
  course_id: string
  title: string
  description: string
  current_deadline: string
  created_at: string
}

export interface DeadlineChange {
  id: string
  assignment_id: string
  previous_deadline: string
  new_deadline: string
  changed_by: string
  reason: string | null
  changed_at: string
}

export interface AssignmentProgress {
  id: string
  student_id: string
  assignment_id: string
  status: ProgressStatus
}

export interface Notification {
  id: string
  recipient_id: string
  assignment_id: string | null
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
}
