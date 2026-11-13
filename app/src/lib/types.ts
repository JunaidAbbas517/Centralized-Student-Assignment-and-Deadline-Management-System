export type Role = 'student' | 'instructor' | 'admin'
export type AccountStatus = 'active' | 'pending' | 'rejected'
export type ProgressStatus = 'pending' | 'in_progress' | 'completed'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  status: AccountStatus
  created_at?: string
}

export interface Course {
  id: string
  instructor_id: string
  name: string
  course_code: string
  enrollment_code: string
  archived: boolean
}

export type SubmissionType = 'file' | 'link' | 'file_and_link'

export interface Assignment {
  id: string
  course_id: string
  title: string
  description: string
  current_deadline: string
  created_at: string
  total_marks: number
  submission_type: SubmissionType
  /** Lower-case extensions without the dot. Empty means any file type. */
  allowed_extensions: string[]
  max_file_mb: number
  max_files: number
  summary_required: boolean
  allow_late: boolean
}

export interface AssignmentFile {
  id: string
  assignment_id: string
  path: string
  name: string
  size: number
  uploaded_at: string
}

export interface SubmissionFile {
  id: string
  submission_id: string
  path: string
  name: string
  size: number
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  attempt: number
  summary: string
  link: string | null
  is_late: boolean
  submitted_at: string
  submission_files: SubmissionFile[]
}

export interface Grade {
  id: string
  assignment_id: string
  student_id: string
  submission_id: string | null
  marks: number
  feedback: string
  graded_by: string
  graded_at: string
  returned_at: string | null
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