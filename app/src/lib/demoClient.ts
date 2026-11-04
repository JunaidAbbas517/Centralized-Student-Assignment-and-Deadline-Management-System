/**
 * In-memory stand-in for the Supabase client, used only in demo mode (`npm run demo`)
 * so the UI can be reviewed without any backend. It supports just the query shapes
 * the app uses, and mimics the row-level visibility rules loosely.
 */
import { seed } from './demoSeed'

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
