import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import DeadlineTimeline from '../components/DeadlineTimeline'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btnGhost, Card, CourseDot, courseTheme, ErrorText, Pill, Segmented } from '../components/ui'
import {
  dayKey, daysFromToday, formatDay, formatFull, monthGridFull,
} from '../lib/dates'
import { saveProgress } from '../lib/progress'
import type { DeadlineChange, ProgressStatus } from '../lib/types'
import { useAssignments, type AssignmentWithCourse } from '../lib/useAssignments'

interface Entry {
  assignment: AssignmentWithCourse
  kind: 'current' | 'previous'
  changed: boolean
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'student'
  const { assignments, changed, history, progress, people, loading, error, reload } = useAssignments(role)
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    const add = (key: string, entry: Entry) => map.set(key, [...(map.get(key) ?? []), entry])
    for (const a of assignments) {
      const change = changed[a.id]
      add(dayKey(new Date(a.current_deadline)), { assignment: a, kind: 'current', changed: Boolean(change) })
      if (change) add(dayKey(new Date(change.previous_deadline)), { assignment: a, kind: 'previous', changed: true })
    }
    return map
  }, [assignments, changed])

  const legend = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of assignments) m.set(a.course_id, a.courses?.name ?? '')
    return [...m.entries()]
  }, [assignments])

  const cells = monthGridFull(cursor.year, cursor.month)
  const title = new Date(cursor.year, cursor.month, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const todayKey = dayKey(new Date())

  const activeId = selected ?? Object.keys(changed)[0] ?? assignments[0]?.id ?? null
  const active = assignments.find((a) => a.id === activeId) ?? null

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="rise mr-2 text-[2rem] font-semibold tracking-tight">{title}</h1>
        <button className={`${btnGhost} !px-2.5`} onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <button className={`${btnGhost} !px-2.5`} onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        <button
          className={btnGhost}
          onClick={() => {
            const n = new Date()
            setCursor({ year: n.getFullYear(), month: n.getMonth() })
          }}
        >
          Today
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {legend.map(([id, name]) => (
            <span key={id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium">
              <CourseDot courseId={id} /> {name}
            </span>
          ))}
        </div>
      </div>
      <ErrorText message={error} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="!p-0 self-start overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-3 py-2 text-xs font-semibold text-slate-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((date) => {
                  const key = dayKey(date)
                  const inMonth = date.getMonth() === cursor.month
                  const entries = byDay.get(key) ?? []
                  return (
                    <div key={key} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${inMonth ? '' : 'bg-slate-50/70'}`}>
                      <div className="mb-1 flex px-1">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            key === todayKey ? 'bg-indigo-600 text-white' : inMonth ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {entries.map((e) => {
                          const theme = courseTheme(e.assignment.course_id)
                          const isSel = e.assignment.id === activeId
                          const prev = e.kind === 'previous'
                          return (
                            <li key={`${e.assignment.id}-${e.kind}`}>
                              <button
                                onClick={() => setSelected(e.assignment.id)}
                                aria-pressed={isSel}
                                title={prev ? `Previous deadline: ${e.assignment.title}` : e.assignment.title}
                                className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs font-semibold ${
                                  prev ? 'border-dashed border-slate-300 bg-white text-slate-500' : 'border-transparent'
                                } ${isSel && !prev ? '!border-indigo-600 ring-2 ring-indigo-200' : ''} ${inMonth ? '' : 'opacity-60'}`}
                                style={prev ? undefined : { background: theme.bg, color: theme.text }}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: prev ? '#cbd5e1' : theme.dot }} />
                                <span className="truncate">{prev ? 'Was: ' : ''}{e.assignment.title}</span>
                                {!prev && e.changed && <RefreshCw size={11} className="ml-auto shrink-0" aria-label="Deadline changed" />}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 px-4 py-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 text-orange-700"><RefreshCw size={12} /> Deadline changed</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-6 rounded border border-dashed border-slate-300" /> Previous deadline</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-indigo-600" /> Today</span>
          </div>
        </Card>

        {active ? (
          <DetailPanel
            assignment={active}
            changes={history[active.id] ?? []}
            people={people}
            role={role}
            status={progress[active.id] ?? 'pending'}
            onStatus={async (s) => {
              if (!profile) return
              await saveProgress(profile.id, active.id, s)
              await reload()
            }}
          />
        ) : (
          <Card className="self-start text-sm text-slate-500">No assignments to show yet.</Card>
        )}
      </div>
    </div>
  )
}

function DetailPanel({ assignment: a, changes, people, role, status, onStatus }: {
  assignment: AssignmentWithCourse
  changes: DeadlineChange[]
  people: Record<string, string>
  role: 'student' | 'instructor'
  status: ProgressStatus
  onStatus: (s: ProgressStatus) => void
}) {
  const theme = courseTheme(a.course_id)
  const latest = changes[0]
  const delta = latest ? Math.round((new Date(latest.new_deadline).getTime() - new Date(latest.previous_deadline).getTime()) / 86400000) : 0
  const changedWhen = latest ? (daysFromToday(latest.changed_at) === 0 ? 'today' : formatDay(latest.changed_at)) : ''

  return (
    <Card className="self-start">
      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: theme.text }}>
        <CourseDot courseId={a.course_id} /> {a.courses?.name}
      </div>
      <h2 className="mt-1 text-2xl font-bold">{a.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{a.description || 'No description.'}</p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <div className="text-xs font-medium text-slate-500">Current deadline</div>
        <div className="mt-1 text-lg font-bold">{formatFull(a.current_deadline)}</div>
        {latest && (
          <div className="mt-2">
            <Pill tone="changed">
              <RefreshCw size={11} /> Changed {changedWhen} · {delta >= 0 ? '+' : ''}{delta} days
            </Pill>
          </div>
        )}
      </div>

      {role === 'student' ? (
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Your progress</div>
          <Segmented
            value={status}
            onChange={onStatus}
            options={[{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }]}
          />
          <p className="mt-1.5 text-xs text-slate-500">Only you can see your progress.</p>
        </div>
      ) : (
        <Link to={`/assignments/${a.id}`} className={`${btnGhost} mt-5 w-full`}>Open to change deadline</Link>
      )}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="mb-4 text-sm font-semibold">Deadline history</div>
        <DeadlineTimeline changes={changes} currentDeadline={a.current_deadline} createdAt={a.created_at} people={people} />
      </div>
    </Card>
  )
}
