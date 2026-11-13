import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, RefreshCw, TriangleAlert } from 'lucide-react'
import DeadlineTimeline from '../components/DeadlineTimeline'
import WorkSteps from '../components/WorkSteps'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { btn, btnGhost, Card, CourseDot, courseTheme, ErrorText, label, Pill, WorkPill } from '../components/ui'
import { dayKey, daysFromToday, formatDay, formatFull, monthGridFull, relativeLabel } from '../lib/dates'
import { setStarted } from '../lib/progress'
import type { DeadlineChange } from '../lib/types'
import { useAssignments, type AssignmentWithCourse } from '../lib/useAssignments'
import { isHandedIn, nextStep, type ClassWork, type WorkInfo } from '../lib/workStatus'

interface Entry {
  assignment: AssignmentWithCourse
  kind: 'current' | 'previous'
  changed: boolean
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PER_DAY = 2

export default function CalendarPage() {
  const { profile } = useAuth()
  const role = profile?.role === 'instructor' ? 'instructor' : 'student'
  const { assignments, work, classWork, changed, history, people, loading, error, reload } = useAssignments(role)
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    const add = (key: string, entry: Entry) => map.set(key, [...(map.get(key) ?? []), entry])
    for (const a of assignments) {
      const change = changed[a.id]
      add(dayKey(new Date(a.current_deadline)), { assignment: a, kind: 'current', changed: Boolean(change) })
      if (change) add(dayKey(new Date(change.previous_deadline)), { assignment: a, kind: 'previous', changed: true })
    }
    // Real deadlines first; "was" markers last.
    for (const list of map.values()) list.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'current' ? -1 : 1))
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

  const upcomingId = assignments.find((a) => !relativeLabel(a.current_deadline).overdue)?.id
  const activeId = selected ?? upcomingId ?? assignments[0]?.id ?? null
  const active = assignments.find((a) => a.id === activeId) ?? null

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setExpanded(null)
  }

  if (loading) return <p>Loading…</p>

  const chip = (e: Entry, inMonth: boolean, full = false) => (
    <EntryChip
      key={`${e.assignment.id}-${e.kind}`}
      entry={e}
      work={work[e.assignment.id]}
      selected={e.assignment.id === activeId}
      dim={!inMonth}
      full={full}
      onSelect={() => setSelected(e.assignment.id)}
    />
  )

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
            setExpanded(null)
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="!p-0 self-start overflow-hidden">
          {/* Month grid on laptop screens and up; below that a day cell is too narrow to read titles. */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-xs font-semibold text-slate-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date) => {
                const key = dayKey(date)
                const inMonth = date.getMonth() === cursor.month
                const weekend = date.getDay() === 0 || date.getDay() === 6
                const entries = byDay.get(key) ?? []
                const open = expanded === key
                const shown = open ? entries : entries.slice(0, PER_DAY)
                const hidden = entries.length - shown.length
                return (
                  <div
                    key={key}
                    className={`min-h-28 min-w-0 border-b border-r border-slate-100 p-1 [&:nth-child(7n)]:border-r-0 ${
                      inMonth ? (weekend ? 'bg-slate-50/40' : '') : 'bg-slate-50/80'
                    }`}
                  >
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
                      {shown.map((e) => <li key={`${e.assignment.id}-${e.kind}`}>{chip(e, inMonth)}</li>)}
                    </ul>
                    {(hidden > 0 || (open && entries.length > PER_DAY)) && (
                      <button
                        className="mt-1 w-full rounded px-1.5 text-left text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                        onClick={() => setExpanded(open ? null : key)}
                      >
                        {open ? 'Show less' : `+${hidden} more`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tablets and phones: the month as a list of days. */}
          <ol className="divide-y divide-slate-100 lg:hidden">
            {cells
              .filter((d) => d.getMonth() === cursor.month && (byDay.get(dayKey(d)) ?? []).length > 0)
              .map((d) => (
                <li key={dayKey(d)} className="flex gap-3 px-4 py-3">
                  <div className={`w-11 shrink-0 text-center ${dayKey(d) === todayKey ? 'text-indigo-700' : 'text-slate-600'}`}>
                    <div className="font-mono text-[10px] uppercase">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                    <div className="tnum text-lg font-semibold">{d.getDate()}</div>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {(byDay.get(dayKey(d)) ?? []).map((e) => <li key={`${e.assignment.id}-${e.kind}`}>{chip(e, true, true)}</li>)}
                  </ul>
                </li>
              ))}
            {!cells.some((d) => d.getMonth() === cursor.month && byDay.has(dayKey(d))) && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No deadlines this month.</li>
            )}
          </ol>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            {role === 'student' && (
              <>
                <span className="flex items-center gap-1.5"><Check size={12} className="text-emerald-600" /> Submitted</span>
                <span className="flex items-center gap-1.5 text-rose-700"><TriangleAlert size={12} /> Missing</span>
              </>
            )}
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
            work={work[active.id]}
            classWork={classWork[active.id]}
            onToggleStarted={async (started) => {
              if (!profile) return
              await setStarted(profile.id, active.id, started)
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

/** "Lab 3: Convolutional networks" -> "Lab 3"; the full title is in the tooltip and side panel. */
function shortTitle(title: string): string {
  const head = title.split(':')[0].trim()
  return head.length >= 3 ? head : title
}

function EntryChip({ entry: e, work, selected, dim, full, onSelect }: {
  entry: Entry
  work: WorkInfo | undefined
  selected: boolean
  dim: boolean
  full: boolean
  onSelect: () => void
}) {
  const theme = courseTheme(e.assignment.course_id)
  const prev = e.kind === 'previous'
  const done = !prev && isHandedIn(work?.state)
  const missing = !prev && (work?.state === 'missing' || work?.state === 'closed')
  const status = done ? (work?.state === 'graded' ? 'graded' : 'submitted') : missing ? 'missing' : ''
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      title={`${prev ? 'Previous deadline: ' : ''}${e.assignment.title}${status ? ` (${status})` : ''}`}
      className={`flex w-full items-start gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold leading-tight ${
        prev ? 'border-dashed border-slate-300 bg-white text-slate-500' : 'border-transparent'
      } ${selected && !prev ? '!border-indigo-600 ring-2 ring-indigo-200' : ''} ${dim ? 'opacity-60' : ''} ${done ? 'opacity-70' : ''}`}
      style={prev ? undefined : { background: theme.bg, color: theme.text }}
    >
      {done ? (
        <Check size={11} className="mt-px shrink-0 text-emerald-700" aria-hidden="true" />
      ) : missing ? (
        <TriangleAlert size={11} className="mt-px shrink-0 text-rose-700" aria-hidden="true" />
      ) : (
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: prev ? '#cbd5e1' : theme.dot }} />
      )}
      <span className="line-clamp-3 min-w-0 flex-1 hyphens-auto break-words">
        {prev ? 'Was: ' : ''}{full ? e.assignment.title : shortTitle(e.assignment.title)}
      </span>
      {!prev && e.changed && <RefreshCw size={10} className="mt-0.5 shrink-0" aria-label="Deadline changed" />}
    </button>
  )
}

function DetailPanel({ assignment: a, changes, people, role, work, classWork, onToggleStarted }: {
  assignment: AssignmentWithCourse
  changes: DeadlineChange[]
  people: Record<string, string>
  role: 'student' | 'instructor'
  work: WorkInfo | undefined
  classWork: ClassWork | undefined
  onToggleStarted: (started: boolean) => void
}) {
  const theme = courseTheme(a.course_id)
  const latest = changes[0]
  const delta = latest ? Math.round((new Date(latest.new_deadline).getTime() - new Date(latest.previous_deadline).getTime()) / 86400000) : 0
  const changedWhen = latest ? (daysFromToday(latest.changed_at) === 0 ? 'today' : formatDay(latest.changed_at)) : ''
  const rel = relativeLabel(a.current_deadline)
  const canToggle = work?.state === 'not_started' || work?.state === 'in_progress'
  const actionable = work?.state === 'not_started' || work?.state === 'in_progress' || work?.state === 'missing'

  return (
    <Card className="self-start">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold" style={{ color: theme.text }}>
          <CourseDot courseId={a.course_id} /> <span className="truncate">{a.courses?.name}</span>
        </div>
        {role === 'student' && work && <WorkPill work={work} />}
      </div>
      <h2 className="mt-1 text-2xl font-bold">{a.title}</h2>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.description || 'No instructions yet.'}</p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <div className="text-xs font-medium text-slate-500">Current deadline</div>
        <div className="mt-1 text-lg font-bold">{formatFull(a.current_deadline)}</div>
        <div className={`mt-0.5 font-mono text-xs ${rel.overdue && work?.state === 'missing' ? 'text-rose-700' : 'text-slate-500'}`}>
          {rel.overdue ? (work && isHandedIn(work.state) ? 'closed' : rel.text) : rel.text}
        </div>
        {latest && (
          <div className="mt-2">
            <Pill tone="changed">
              <RefreshCw size={11} /> Changed {changedWhen} · {delta >= 0 ? '+' : ''}{delta} days
            </Pill>
          </div>
        )}
      </div>

      {role === 'student' && work ? (
        <div className="mt-5">
          <div className={`${label} mb-3`}>Your progress</div>
          <WorkSteps work={work} />
          {canToggle && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                checked={work.state === 'in_progress'}
                onChange={(e) => onToggleStarted(e.target.checked)}
              />
              I've started working on this
            </label>
          )}
          <Link to={`/assignments/${a.id}`} className={`${actionable ? btn : btnGhost} mt-4 w-full`}>
            {nextStep(work.state)} <ChevronRight size={15} aria-hidden="true" />
          </Link>
          {work.state === 'closed' && <p className="mt-2 text-xs text-slate-500">The deadline has passed and this assignment does not accept late work.</p>}
        </div>
      ) : role === 'instructor' ? (
        <div className="mt-5">
          {classWork && (
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[['Submitted', `${classWork.submitted}/${classWork.enrolled}`], ['To grade', classWork.toGrade], ['Returned', classWork.returned]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-2 py-2.5 ring-1 ring-inset ring-slate-200/70">
                  <div className="tnum text-lg font-semibold text-slate-900">{v}</div>
                  <div className={label}>{k}</div>
                </div>
              ))}
            </div>
          )}
          <Link to={`/assignments/${a.id}`} className={`${btn} w-full`}>
            {classWork && classWork.toGrade > 0 ? 'Grade submissions' : 'Open assignment'} <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="mb-4 text-sm font-semibold">Deadline history</div>
        <DeadlineTimeline changes={changes} currentDeadline={a.current_deadline} createdAt={a.created_at} people={people} />
      </div>
    </Card>
  )
}
