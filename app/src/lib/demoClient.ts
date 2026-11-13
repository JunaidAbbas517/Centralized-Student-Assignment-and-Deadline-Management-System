/**
 * In-memory stand-in for the Supabase client, used only in demo mode (`npm run demo`)
 * so the UI can be reviewed without any backend. It supports just the query shapes
 * the app uses, and mimics the row-level visibility rules loosely.
 */
import { ASSIGNMENT_DEFAULTS, seed } from './demoSeed'

type Row = Record<string, unknown>
interface Session { user: { id: string } }
type Listener = (event: string, session: Session | null) => void

let counter = 0
const uid = () => `id-${Date.now().toString(36)}-${counter++}`


// Embedded relations: table -> embed name -> [foreign key on this table, target table]
const RELATIONS: Record<string, Record<string, [string, string]>> = {
  assignments: { courses: ['course_id', 'courses'] },
  deadline_changes: { assignments: ['assignment_id', 'assignments'] },
  enrollments: { profiles: ['student_id', 'profiles'] },
  notifications: { assignments: ['assignment_id', 'assignments'] },
}

// One-to-many embeds: table -> embed name -> [foreign key on the child table, child table]
const CHILDREN: Record<string, Record<string, [string, string]>> = {
  submissions: { submission_files: ['submission_id', 'submission_files'] },
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function createDemoClient() {
  const db = seed()
  let session: Session | null = null
  // `?as=student` or `?as=instructor` in the URL opens the demo already signed in.
  try {
    const as = new URLSearchParams(window.location.search).get('as')
    const who = db.profiles.find((p) => p.role === as)
    if (who) session = { user: { id: String(who.id) } }
  } catch {
    // no URL access; start signed out
  }
  const listeners = new Set<Listener>()
  const setSession = (next: Session | null) => {
    session = next
    listeners.forEach((l) => l(next ? 'SIGNED_IN' : 'SIGNED_OUT', next))
  }

  const me = () => db.profiles.find((p) => p.id === session?.user.id)
  const isInstructor = () => me()?.role === 'instructor'
  const enrolledIn = (courseId: unknown) =>
    db.enrollments.some((e) => e.course_id === courseId && e.student_id === session?.user.id)
  const teaches = (assignmentId: unknown) => {
    const a = db.assignments.find((x) => x.id === assignmentId)
    return !!a && db.courses.some((c) => c.id === a.course_id && c.instructor_id === session?.user.id)
  }
  const files = new Map<string, Blob>()

  function visible(table: string, row: Row): boolean {
    switch (table) {
      case 'courses':
        return isInstructor() ? row.instructor_id === session?.user.id : enrolledIn(row.id)
      case 'assignments': {
        const course = db.courses.find((c) => c.id === row.course_id)
        return !!course && visible('courses', course)
      }
      case 'deadline_changes': {
        const a = db.assignments.find((x) => x.id === row.assignment_id)
        return !!a && visible('assignments', a)
      }
      case 'enrollments': {
        const course = db.courses.find((c) => c.id === row.course_id)
        return isInstructor() ? !!course && visible('courses', course) : row.student_id === session?.user.id
      }
      case 'notifications':
        return row.recipient_id === session?.user.id
      case 'profiles':
        return me()?.role === 'admin' || me()?.role === 'instructor' || row.id === session?.user.id || row.role === 'instructor'
      case 'assignment_progress':
        return row.student_id === session?.user.id
      case 'assignment_files': {
        const a = db.assignments.find((x) => x.id === row.assignment_id)
        return !!a && visible('assignments', a)
      }
      case 'submissions':
        return row.student_id === session?.user.id || me()?.role === 'admin' || teaches(row.assignment_id)
      case 'submission_files': {
        const s = db.submissions.find((x) => x.id === row.submission_id)
        return !!s && visible('submissions', s)
      }
      case 'grades':
        return (row.student_id === session?.user.id && !!row.returned_at) || me()?.role === 'admin' || teaches(row.assignment_id)
      default:
        return true
    }
  }

  function project(table: string, row: Row, selectStr: string): Row {
    const tokens = splitTop(selectStr)
    const all = tokens.includes('*')
    const out: Row = all ? { ...row } : {}
    for (const t of tokens) {
      if (t === '*') continue
      const m = t.match(/^(\w+)\((.*)\)$/s)
      const child = m ? CHILDREN[table]?.[m[1]] : undefined
      if (m && child) {
        out[m[1]] = db[child[1]].filter((r) => r[child[0]] === row.id && visible(child[1], r)).map((r) => project(child[1], r, m[2]))
      } else if (m) {
        const rel = RELATIONS[table]?.[m[1]]
        const target = rel ? db[rel[1]].find((r) => r.id === row[rel[0]]) : undefined
        out[m[1]] = target ? project(rel![1], target, m[2]) : null
      } else if (!all) out[t] = row[t]
    }
    return out
  }

  class Query implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    private selectStr = '*'
    private filters: [string, unknown][] = []
    private orderBy: { col: string; asc: boolean } | null = null
    private limitN: number | null = null
    private payload: Row = {}
    private conflict: string[] = []
    private head = false
    private returning = false
    private mode: 'many' | 'single' | 'maybe' = 'many'
    private table: string
    constructor(table: string) {
      this.table = table
    }

    select(str = '*', opts?: { count?: string; head?: boolean }) {
      if (this.op !== 'select') this.returning = true
      this.selectStr = str
      this.head = Boolean(opts?.head)
      return this
    }
    insert(row: Row) { this.op = 'insert'; this.payload = row; return this }
    update(patch: Row) { this.op = 'update'; this.payload = patch; return this }
    upsert(row: Row, opts?: { onConflict?: string }) {
      this.op = 'upsert'
      this.payload = row
      this.conflict = (opts?.onConflict ?? 'id').split(',')
      return this
    }
    delete() { this.op = 'delete'; return this }
    eq(col: string, val: unknown) { this.filters.push([col, val]); return this }
    order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this }
    limit(n: number) { this.limitN = n; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }

    then<R1, R2>(
      onfulfilled?: ((v: { data: unknown; error: { message: string } | null; count?: number }) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
    ) {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    }

    private matching(): Row[] {
      return db[this.table].filter((r) => visible(this.table, r) && this.filters.every(([c, v]) => r[c] === v))
    }

    private run() {
      const rows = db[this.table]
      if (this.op === 'insert') {
        const row: Row = { id: uid(), created_at: new Date().toISOString(), ...this.payload }
        if (this.table === 'courses') {
          row.archived = false
          row.enrollment_code = uid().slice(-8).toUpperCase()
        }
        if (this.table === 'assignments') Object.assign(row, { ...ASSIGNMENT_DEFAULTS, ...this.payload })
        if (this.table === 'assignment_files') row.uploaded_at = row.created_at
        rows.push(row)
        if (!this.returning) return { data: null, error: null }
        const out = project(this.table, row, this.selectStr)
        return { data: this.mode === 'many' ? [out] : out, error: null }
      }
      if (this.op === 'update') {
        this.matching().forEach((r) => Object.assign(r, this.payload))
        return { data: null, error: null }
      }
      if (this.op === 'delete') {
        const gone = new Set(this.matching())
        db[this.table] = rows.filter((r) => !gone.has(r))
        return { data: null, error: null }
      }
      if (this.op === 'upsert') {
        const existing = rows.find((r) => this.conflict.every((c) => r[c] === this.payload[c]))
        if (existing) Object.assign(existing, this.payload)
        else rows.push({ id: uid(), ...this.payload })
        return { data: null, error: null }
      }

      let found = this.matching()
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        found = [...found].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
      }
      if (this.limitN != null) found = found.slice(0, this.limitN)
      if (this.head) return { data: null, error: null, count: found.length }
      const data = found.map((r) => project(this.table, r, this.selectStr))
      if (this.mode === 'single') {
        return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'Row not found' } }
      }
      if (this.mode === 'maybe') return { data: data[0] ?? null, error: null }
      return { data, error: null }
    }
  }

  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name === 'enroll_by_code') {
      const course = db.courses.find((c) => c.enrollment_code === String(args.p_code).trim().toUpperCase() && !c.archived)
      if (!course) return { data: null, error: { message: 'Invalid enrollment code' } }
      if (!enrolledIn(course.id)) db.enrollments.push({ id: uid(), student_id: session?.user.id, course_id: course.id })
      return { data: course.id, error: null }
    }
    if (name === 'change_deadline') {
      const a = db.assignments.find((x) => x.id === args.p_assignment)
      if (!a) return { data: null, error: { message: 'Assignment not found' } }
      const change = {
        id: uid(), assignment_id: a.id, previous_deadline: a.current_deadline, new_deadline: args.p_new_deadline,
        changed_by: session?.user.id, reason: String(args.p_reason ?? '').trim() || null, changed_at: new Date().toISOString(),
      }
      a.current_deadline = args.p_new_deadline
      db.deadline_changes.push(change)
      db.enrollments.filter((e) => e.course_id === a.course_id).forEach((e) =>
        db.notifications.push({
          id: uid(), recipient_id: e.student_id, assignment_id: a.id, deadline_change_id: change.id,
          type: 'deadline_changed', message: `Deadline changed: ${a.title}`, is_read: false, created_at: change.changed_at,
        }),
      )
      return { data: change.id, error: null }
    }
    if (name === 'set_instructor_status') {
      if (me()?.role !== 'admin') return { data: null, error: { message: 'Only an admin can verify instructors' } }
      const p = db.profiles.find((x) => x.id === args.p_user && x.role === 'instructor')
      if (!p) return { data: null, error: { message: 'That user is not an instructor' } }
      p.status = args.p_status
      return { data: null, error: null }
    }
    if (name === 'admin_stats') {
      if (me()?.role !== 'admin') return { data: null, error: { message: 'Only an admin can see platform statistics' } }
      const now = Date.now()
      const count = (rows: Row[], f: (r: Row) => boolean) => rows.filter(f).length
      const P = db.profiles
      return {
        data: {
          students: count(P, (p) => p.role === 'student'),
          instructors: count(P, (p) => p.role === 'instructor' && p.status === 'active'),
          pending: count(P, (p) => p.role === 'instructor' && p.status === 'pending'),
          rejected: count(P, (p) => p.role === 'instructor' && p.status === 'rejected'),
          courses: count(db.courses, (c) => !c.archived),
          archived_courses: count(db.courses, (c) => !!c.archived),
          assignments: db.assignments.length,
          upcoming: count(db.assignments, (a) => new Date(String(a.current_deadline)).getTime() > now),
          enrollments: db.enrollments.length,
          deadline_changes: db.deadline_changes.length,
          new_users_7d: count(P, (p) => now - new Date(String(p.created_at)).getTime() < 7 * 864e5),
          completed: count(db.assignment_progress, (x) => x.status === 'completed'),
          course_list: db.courses
            .map((c) => ({
              id: c.id, name: c.name, course_code: c.course_code, archived: c.archived,
              instructor: P.find((p) => p.id === c.instructor_id)?.full_name ?? '',
              students: count(db.enrollments, (e) => e.course_id === c.id),
              assignments: count(db.assignments, (a) => a.course_id === c.id),
            }))
            .sort((x, y) => y.students - x.students),
        },
        error: null,
      }
    }
    if (name === 'generate_my_reminders') {
      const me = session?.user.id
      const now = Date.now()
      let created = 0
      for (const a of db.assignments) {
        const due = new Date(String(a.current_deadline)).getTime()
        if (due <= now || due > now + 48 * 3600 * 1000 || !enrolledIn(String(a.course_id))) continue
        const done = db.assignment_progress.some((p) => p.student_id === me && p.assignment_id === a.id && p.status === 'completed')
        const sent = db.notifications.some((n) => n.recipient_id === me && n.assignment_id === a.id && n.type === 'reminder')
        if (done || sent) continue
        db.notifications.push({
          id: uid(), recipient_id: me, assignment_id: a.id, deadline_change_id: null, type: 'reminder',
          message: `Reminder: ${a.title} is due within 2 days`, is_read: false, created_at: new Date().toISOString(),
        })
        created++
      }
      return { data: created, error: null }
    }
    if (name === 'submit_assignment') {
      const me = session?.user.id
      const a = db.assignments.find((x) => x.id === args.p_assignment)
      if (!a || !enrolledIn(a.course_id)) return { data: null, error: { message: 'You are not enrolled in this course' } }
      const mine = db.submissions.filter((s) => s.assignment_id === a.id && s.student_id === me)
      const late = Date.now() > new Date(String(a.current_deadline)).getTime()
      if (late && (!a.allow_late || mine.length > 0)) return { data: null, error: { message: 'The deadline has passed' } }
      const refs = (args.p_files ?? []) as { path: string; name: string }[]
      const sub: Row = {
        id: uid(), assignment_id: a.id, student_id: me, attempt: mine.length + 1, summary: String(args.p_summary ?? '').trim(),
        link: String(args.p_link ?? '').trim() || null, is_late: late, submitted_at: new Date().toISOString(),
      }
      db.submissions.push(sub)
      for (const f of refs) db.submission_files.push({ id: uid(), submission_id: sub.id, path: f.path, name: f.name, size: files.get(`submissions/${f.path}`)?.size ?? 0 })
      const p = db.assignment_progress.find((x) => x.student_id === me && x.assignment_id === a.id)
      if (p) p.status = 'completed'
      else db.assignment_progress.push({ id: uid(), student_id: me, assignment_id: a.id, status: 'completed' })
      db.notifications.push({
        id: uid(), recipient_id: me, assignment_id: a.id, deadline_change_id: null, type: 'submission_received',
        message: `${late ? 'Submitted late' : 'Submitted'}: ${a.title}`, is_read: false, created_at: sub.submitted_at,
      })
      return { data: sub.id, error: null }
    }
    if (name === 'grade_submission') {
      const a = db.assignments.find((x) => x.id === args.p_assignment)
      if (!a || !teaches(a.id)) return { data: null, error: { message: 'Only the course instructor can grade this assignment' } }
      const marks = Number(args.p_marks)
      if (marks < 0 || marks > Number(a.total_marks)) return { data: null, error: { message: `Marks must be between 0 and ${a.total_marks}` } }
      const latest = db.submissions
        .filter((s) => s.assignment_id === a.id && s.student_id === args.p_student)
        .sort((x, y) => Number(y.attempt) - Number(x.attempt))[0]
      const now = new Date().toISOString()
      let g = db.grades.find((x) => x.assignment_id === a.id && x.student_id === args.p_student)
      if (!g) db.grades.push((g = { id: uid(), assignment_id: a.id, student_id: args.p_student, returned_at: null }))
      Object.assign(g, {
        submission_id: latest?.id ?? null, marks, feedback: String(args.p_feedback ?? '').trim(), graded_by: session?.user.id,
        graded_at: now, returned_at: args.p_return ? now : g.returned_at,
      })
      if (args.p_return) {
        db.notifications.push({
          id: uid(), recipient_id: args.p_student, assignment_id: a.id, deadline_change_id: null, type: 'graded',
          message: `Graded: ${a.title} (${marks}/${a.total_marks})`, is_read: false, created_at: now,
        })
      }
      return { data: null, error: null }
    }
    return { data: null, error: { message: `Unknown function ${name}` } }
  }

  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: Blob) => {
        files.set(`${bucket}/${path}`, file)
        return { data: { path }, error: null }
      },
      list: async (prefix: string) => {
        const names = new Map<string, boolean>()
        for (const key of files.keys()) {
          const start = `${bucket}/${prefix}/`
          if (!key.startsWith(start)) continue
          const [head, ...rest] = key.slice(start.length).split('/')
          names.set(head, rest.length === 0)
        }
        return { data: [...names].map(([name, isFile]) => ({ name, id: isFile ? name : null })), error: null }
      },
      remove: async (paths: string[]) => {
        for (const p of paths) files.delete(`${bucket}/${p}`)
        return { data: [], error: null }
      },
      createSignedUrl: async (path: string) => {
        const blob = files.get(`${bucket}/${path}`)
        return blob
          ? { data: { signedUrl: URL.createObjectURL(blob) }, error: null }
          : { data: null, error: { message: 'Sample files are not available in demo mode.' } }
      },
    }),
  }

  const auth = {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb: Listener) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
    signInWithPassword: async ({ email }: { email: string }) => {
      const p = db.profiles.find((x) => x.email === email)
      if (!p) return { data: null, error: { message: 'Demo users: student@demo.edu or instructor@demo.edu' } }
      setSession({ user: { id: String(p.id) } })
      return { data: { session }, error: null }
    },
    signUp: async ({ email, options }: { email: string; options?: { data?: { full_name?: string; requested_role?: string } } }) => {
      const id = uid()
      const instructor = options?.data?.requested_role === 'instructor'
      db.profiles.push({
        id, full_name: options?.data?.full_name ?? '', email, created_at: new Date().toISOString(),
        role: instructor ? 'instructor' : 'student', status: instructor ? 'pending' : 'active',
      })
      setSession({ user: { id } })
      return { data: { session }, error: null }
    },
    signOut: async () => {
      setSession(null)
      return { error: null }
    },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
  }

  return { from: (table: string) => new Query(table), rpc, auth, storage }
}
