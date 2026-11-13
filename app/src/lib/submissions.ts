import { ASSIGNMENT_BUCKET, safeFileName, SUBMISSION_BUCKET, uploadFile } from './files'
import { supabase } from './supabase'
import type { Assignment, AssignmentFile, Grade, Submission } from './types'

export async function loadAssignmentFiles(assignmentId: string): Promise<AssignmentFile[]> {
  const { data } = await supabase.from('assignment_files').select('*').eq('assignment_id', assignmentId).order('uploaded_at')
  return (data ?? []) as AssignmentFile[]
}

/** All attempts visible to the caller (RLS: own for students, whole course for its instructor), newest first. */
export async function loadSubmissions(assignmentId: string): Promise<Submission[]> {
  const { data } = await supabase
    .from('submissions')
    .select('*, submission_files(*)')
    .eq('assignment_id', assignmentId)
    .order('attempt', { ascending: false })
  return ((data ?? []) as Submission[]).map((s) => ({ ...s, submission_files: s.submission_files ?? [] }))
}

/** Students only receive their grade once it is returned (RLS). */
export async function loadGrades(assignmentId: string): Promise<Grade[]> {
  const { data } = await supabase.from('grades').select('*').eq('assignment_id', assignmentId)
  return ((data ?? []) as Grade[]).map((g) => ({ ...g, marks: Number(g.marks) }))
}

/** Uploads the files, then records the attempt; the server re-checks every rule. */
export async function submitWork(
  assignment: Pick<Assignment, 'id'>,
  studentId: string,
  files: File[],
  summary: string,
  link: string,
): Promise<string | null> {
  const uploadId = crypto.randomUUID()
  const refs: { path: string; name: string }[] = []
  for (const file of files) {
    const path = `${assignment.id}/${studentId}/${uploadId}/${safeFileName(file.name)}`
    const err = await uploadFile(SUBMISSION_BUCKET, path, file)
    if (err) return err
    refs.push({ path, name: file.name })
  }
  const { error } = await supabase.rpc('submit_assignment', {
    p_assignment: assignment.id,
    p_summary: summary,
    p_link: link,
    p_files: refs,
  })
  return error?.message ?? null
}

/**
 * Removes an assignment's stored files (reference material and every submission upload).
 * Must run before the assignment row is deleted: the storage policies look the assignment up.
 */
export async function removeAssignmentFiles(assignmentId: string): Promise<string | null> {
  for (const bucket of [ASSIGNMENT_BUCKET, SUBMISSION_BUCKET]) {
    const paths = await listFilesUnder(bucket, assignmentId)
    if (typeof paths === 'string') return paths
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) return error.message
    }
  }
  return null
}

/** Every file path under a folder. Storage lists one level at a time; folders have no id. */
async function listFilesUnder(bucket: string, prefix: string): Promise<string[] | string> {
  const out: string[] = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) return error.message
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`
    if (item.id) out.push(path)
    else {
      const nested = await listFilesUnder(bucket, path)
      if (typeof nested === 'string') return nested
      out.push(...nested)
    }
  }
  return out
}

export function gradeWork(assignmentId: string, studentId: string, marks: number, feedback: string, returnToStudent: boolean) {
  return supabase.rpc('grade_submission', {
    p_assignment: assignmentId,
    p_student: studentId,
    p_marks: marks,
    p_feedback: feedback,
    p_return: returnToStudent,
  })
}

/** Whether the student may (re)submit now. Mirrors the checks in submit_assignment(). */
export function submissionWindow(
  assignment: Pick<Assignment, 'current_deadline' | 'allow_late'>,
  attempts: number,
  graded: boolean,
  now: Date = new Date(),
): { open: boolean; late: boolean; reason: string | null } {
  const late = now.getTime() > new Date(assignment.current_deadline).getTime()
  if (graded) return { open: false, late, reason: 'Your work has been graded, so submissions are closed.' }
  if (!late) return { open: true, late, reason: null }
  if (!assignment.allow_late) return { open: false, late, reason: 'The deadline has passed and this assignment does not accept late work.' }
  if (attempts > 0) return { open: false, late, reason: 'The deadline has passed, so you can no longer resubmit.' }
  return { open: true, late, reason: null }
}

export { formatMarks } from './workStatus'
