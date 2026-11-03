import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btnGhost, courseColor, ErrorText } from '../components/ui'
import { dayKey, monthGrid } from '../lib/dates'
import { useAssignments, type AssignmentWithCourse } from '../lib/useAssignments'

interface Entry {
  assignment: AssignmentWithCourse
  kind: 'current' | 'previous'
  changed: boolean
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const { profile } = useAuth()
  const { assignments, changed, loading, error } = useAssignments(profile?.role ?? 'student')
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    const add = (key: string, entry: Entry) => map.set(key, [...(map.get(key) ?? []), entry])
    for (const a of assignments) {
      const change = changed[a.id]
      add(dayKey(new Date(a.current_deadline)), { assignment: a, kind: 'current', changed: Boolean(change) })
      // Faded "previous date" marker for the most recent change.
      if (change) add(dayKey(new Date(change.previous_deadline)), { assignment: a, kind: 'previous', changed: true })
    }
    return map
  }, [assignments, changed])

  const cells = monthGrid(cursor.year, cursor.month)
  const title = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">{title}</h1>
        <button className={btnGhost} onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <button
          className={btnGhost}
          onClick={() => {
            const n = new Date()
            setCursor({ year: n.getFullYear(), month: n.getMonth() })
          }}
        >
          Today
        </button>
        <button className={btnGhost} onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>
      <ErrorText message={error} />
      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-7 gap-px rounded border border-slate-200 bg-slate-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-slate-100 p-1 text-center text-xs font-semibold">{d}</div>
          ))}
          {cells.map((date, i) => {
            const entries = date ? (byDay.get(dayKey(date)) ?? []) : []
            return (
              <div key={i} className={`min-h-24 p-1 ${date ? 'bg-white' : 'bg-slate-50'}`}>
                {date && <div className="mb-1 text-xs text-slate-500">{date.getDate()}</div>}
                <ul className="space-y-1">
                  {entries.map((e) => (
                    <li key={`${e.assignment.id}-${e.kind}`}>
                      <Link
                        to={`/assignments/${e.assignment.id}`}
                        className={`block truncate rounded border px-1 text-xs ${courseColor(e.assignment.course_id)} ${
                          e.kind === 'previous' ? 'border-dashed opacity-50' : ''
                        }`}
                        title={e.kind === 'previous' ? 'Previous deadline' : e.assignment.title}
                      >
                        {e.kind === 'current' && e.changed && <span aria-label="Deadline changed">● </span>}
                        {e.kind === 'previous' && <span>(was) </span>}
                        {e.assignment.courses?.course_code}: {e.assignment.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">● = deadline changed · dashed, faded entry = previous deadline</p>
    </div>
  )
}
