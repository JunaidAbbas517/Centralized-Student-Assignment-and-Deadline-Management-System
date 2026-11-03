/**
 * In-memory stand-in for the Supabase client, used only in demo mode (`npm run demo`)
 * so the UI can be reviewed without any backend. It supports just the query shapes
 * the app uses, and mimics the row-level visibility rules loosely.
 */
type Row = Record<string, unknown>
type Db = Record<string, Row[]>
interface Session { user: { id: string } }
type Listener = (event: string, session: Session | null) => void

const HOUR = 3600 * 1000
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString()
let counter = 0
const uid = () => `id-${Date.now().toString(36)}-${counter++}`

function seed(): Db {
  return {
    profiles: [
      { id: 'u-inst', full_name: 'Dr. Wang Li', email: 'instructor@demo.edu', role: 'instructor' },
      { id: 'u-stu', full_name: 'Ali Khan', email: 'student@demo.edu', role: 'student' },
      { id: 'u-stu2', full_name: 'Chen Mei', email: 'chen@demo.edu', role: 'student' },
    ],
    courses: [
      { id: 'c1', instructor_id: 'u-inst', name: 'Software Engineering', course_code: 'CS301', enrollment_code: 'SE301ABC', archived: false, created_at: at(-500) },
      { id: 'c2', instructor_id: 'u-inst', name: 'Database Systems', course_code: 'CS205', enrollment_code: 'DB205XYZ', archived: false, created_at: at(-400) },
      { id: 'c3', instructor_id: 'u-inst', name: 'Linear Algebra', course_code: 'MA210', enrollment_code: 'LA210QRS', archived: false, created_at: at(-300) },
    ],
    enrollments: [
      { id: 'e1', student_id: 'u-stu', course_id: 'c1' },
      { id: 'e2', student_id: 'u-stu', course_id: 'c2' },
      { id: 'e3', student_id: 'u-stu', course_id: 'c3' },
      { id: 'e4', student_id: 'u-stu2', course_id: 'c1' },
    ],
    assignments: [
      { id: 'a1', course_id: 'c1', title: 'Requirements Specification', description: 'Write an SRS for your project, including use cases and functional requirements.', current_deadline: at(-50), created_at: at(-300) },
      { id: 'a2', course_id: 'c2', title: 'ER Diagram Homework', description: 'Design an ER diagram for a library system.', current_deadline: at(20), created_at: at(-200) },
      { id: 'a3', course_id: 'c1', title: 'Design Document', description: 'Architecture and database design for your system.', current_deadline: at(5 * 24), created_at: at(-100) },
      { id: 'a4', course_id: 'c3', title: 'Problem Set 4', description: 'Eigenvalues and eigenvectors, exercises 1-12.', current_deadline: at(52), created_at: at(-90) },
      { id: 'a5', course_id: 'c2', title: 'SQL Lab Report', description: 'Complete the joins and window functions lab.', current_deadline: at(9 * 24), created_at: at(-80) },
      { id: 'a6', course_id: 'c3', title: 'Midterm Project', description: 'Applications of SVD to image compression.', current_deadline: at(16 * 24), created_at: at(-70) },
      { id: 'a7', course_id: 'c1', title: 'Peer Code Review', description: 'Review a classmate\'s pull request.', current_deadline: at(-120), created_at: at(-400) },
    ],
    deadline_changes: [
      { id: 'd1', assignment_id: 'a3', previous_deadline: at(3 * 24), new_deadline: at(5 * 24), changed_by: 'u-inst', reason: 'Extended after student feedback', changed_at: at(-6) },
    ],
    assignment_progress: [
      { id: 'p1', student_id: 'u-stu', assignment_id: 'a7', status: 'completed' },
      { id: 'p2', student_id: 'u-stu', assignment_id: 'a2', status: 'in_progress' },
    ],
    notifications: [
      { id: 'n1', recipient_id: 'u-stu', assignment_id: 'a3', deadline_change_id: 'd1', type: 'deadline_changed', message: 'Deadline for "Design Document" changed (extended by 2 days)', is_read: false, created_at: at(-6) },
      { id: 'n2', recipient_id: 'u-stu', assignment_id: 'a2', deadline_change_id: null, type: 'deadline_changed', message: 'Deadline for "ER Diagram Homework" changed', is_read: true, created_at: at(-80) },
    ],
  }
}

// Embedded relations: table -> embed name -> [foreign key on this table, target table]
const RELATIONS: Record<string, Record<string, [string, string]>> = {
  assignments: { courses: ['course_id', 'courses'] },
  deadline_changes: { assignments: ['assignment_id', 'assignments'] },
  enrollments: { profiles: ['student_id', 'profiles'] },
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
  const listeners = new Set<Listener>()
  const setSession = (next: Session | null) => {
    session = next
    listeners.forEach((l) => l(next ? 'SIGNED_IN' : 'SIGNED_OUT', next))
  }

  const me = () => db.profiles.find((p) => p.id === session?.user.id)
  const isInstructor = () => me()?.role === 'instructor'
  const enrolledIn = (courseId: unknown) =>
    db.enrollments.some((e) => e.course_id === courseId && e.student_id === session?.user.id)

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
      case 'assignment_progress':
        return row.student_id === session?.user.id
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
      if (m) {
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
    private mode: 'many' | 'single' | 'maybe' = 'many'
    private table: string
    constructor(table: string) {
      this.table = table
    }

    select(str = '*', opts?: { count?: string; head?: boolean }) {
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
        rows.push(row)
        return { data: null, error: null }
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
          type: 'deadline_changed', message: `Deadline for "${a.title}" changed`, is_read: false, created_at: change.changed_at,
        }),
      )
      return { data: change.id, error: null }
    }
    return { data: null, error: { message: `Unknown function ${name}` } }
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
    signUp: async ({ email, options }: { email: string; options?: { data?: { full_name?: string } } }) => {
      const id = uid()
      db.profiles.push({ id, full_name: options?.data?.full_name ?? '', email, role: 'student' })
      setSession({ user: { id } })
      return { data: { session }, error: null }
    },
    signOut: async () => {
      setSession(null)
      return { error: null }
    },
  }

  return { from: (table: string) => new Query(table), rpc, auth }
}
