import { useId, useMemo } from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dayKey, formatShort, startOfDay } from '../lib/dates'
import type { DeadlineChange, ProgressStatus } from '../lib/types'
import type { AssignmentWithCourse } from '../lib/useAssignments'
import { courseTheme } from './ui'

/**
 * The signature element: the next two weeks as one line of time.
 * Each deadline is a pin; a moved deadline draws a dashed arc from its old date to its new one.
 */

interface Props {
  assignments: AssignmentWithCourse[]
  changed: Record<string, DeadlineChange>
  progress?: Record<string, ProgressStatus>
  ahead?: number
  behind?: number
}

const DAY = 86400000
const TRACK_Y = 128
const LANES = [86, 48, 10] // chip top (px) for each lane, nearest the track first
const CHIP_H = 30
const CHIP_W = 18 // estimated chip width, in % of the ribbon

export default function DeadlineRibbon({ assignments, changed, progress = {}, ahead = 14, behind = 3 }: Props) {
  const uid = useId().replace(/:/g, '')
  const now = new Date()
  const start = startOfDay(now).getTime() - behind * DAY
  const days = behind + ahead + 1
  const span = days * DAY
  const x = (iso: string) => ((new Date(iso).getTime() - start) / span) * 100
  const todayX = ((now.getTime() - start) / span) * 100

  const pins = useMemo(() => {
    const inWindow = assignments
      .map((a) => ({ a, px: x(a.current_deadline) }))
      .filter(({ px }) => px >= 0 && px <= 100)
      .sort((p, q) => p.px - q.px)

    // Stack labels in lanes so they never overlap.
    const taken: [number, number][][] = LANES.map(() => [])
    return inWindow.map(({ a, px }) => {
      const right = px > 100 - CHIP_W
      const from = right ? px - CHIP_W : px
      const to = right ? px : px + CHIP_W
      const lane = taken.findIndex((spans) => spans.every(([s, e]) => to <= s || from >= e))
      if (lane >= 0) taken[lane].push([from, to])
      return { a, px, lane, right }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, start])

  const arcs = pins
    .filter(({ a }) => changed[a.id])
    .map(({ a, px }) => {
      const c = changed[a.id]
      const raw = x(c.previous_deadline)
      return { a, from: Math.min(100, Math.max(0, raw)), to: px, offscreen: raw < 0 || raw > 100, c }
    })

  const ticks = Array.from({ length: days }, (_, i) => new Date(start + i * DAY))
  const todayKey = dayKey(now)

  return (
    <figure className="relative">
      <figcaption className="sr-only">Your deadlines from {behind} days ago to {ahead} days from now.</figcaption>
      <div className="scroll-thin -mx-2 overflow-x-auto px-2 pb-1">
        <div className="relative min-w-[720px]" style={{ height: TRACK_Y + 104 }}>
          {/* Day columns: weekends tinted, today's column lifted, the past hatched. */}
          {ticks.map((d, i) => {
            const weekend = d.getDay() === 0 || d.getDay() === 6
            const isToday = dayKey(d) === todayKey
            return (
              <div
                key={i}
                aria-hidden="true"
                className={`absolute top-0 border-l border-slate-200/70 ${isToday ? 'bg-indigo-50/70' : weekend ? 'bg-slate-100/50' : ''}`}
                style={{ left: `${(i / days) * 100}%`, width: `${100 / days}%`, height: TRACK_Y + 40 }}
              />
            )
          })}
          <div
            aria-hidden="true"
            className="absolute top-0"
            style={{
              left: 0,
              width: `${todayX}%`,
              height: TRACK_Y + 40,
              background: 'repeating-linear-gradient(135deg, rgba(25,25,39,.035) 0 6px, transparent 6px 12px)',
            }}
          />

          {/* The track */}
          <div aria-hidden="true" className="absolute inset-x-0 h-[2px] rounded-full bg-slate-200" style={{ top: TRACK_Y - 1 }} />
          <div
            aria-hidden="true"
            className="absolute h-[2px] rounded-full bg-slate-400/70"
            style={{ top: TRACK_Y - 1, left: 0, width: `${todayX}%` }}
          />

          {/* Moved-deadline arcs */}
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 overflow-visible"
            style={{ top: TRACK_Y, height: 46, width: '100%' }}
            viewBox="0 0 100 46"
            preserveAspectRatio="none"
          >
            <defs>
              {arcs.map(({ a, from, to }) => (
                <mask key={a.id} id={`${uid}-m-${a.id}`} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="56">
                  <path d={`M ${from} 3 C ${from} 44, ${to} 44, ${to} 3`} fill="none" stroke="white" strokeWidth="8" pathLength={1} className="draw" />
                </mask>
              ))}
            </defs>
            {arcs.map(({ a, from, to }) => (
              <path
                key={a.id}
                d={`M ${from} 3 C ${from} 44, ${to} 44, ${to} 3`}
                fill="none"
                stroke={courseTheme(a.course_id).dot}
                strokeWidth="1.6"
                strokeDasharray="4 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                mask={`url(#${uid}-m-${a.id})`}
              />
            ))}
          </svg>
          {arcs.map(({ a, from, to, offscreen, c }) => {
            const shift = Math.round((new Date(c.new_deadline).getTime() - new Date(c.previous_deadline).getTime()) / DAY)
            return (
              <div key={a.id} aria-hidden="true">
                {!offscreen && (
                  <span
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed bg-[var(--panel)]"
                    style={{ left: `${from}%`, top: TRACK_Y, borderColor: courseTheme(a.course_id).dot }}
                  />
                )}
                <span
                  className="fade absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 font-mono text-[10px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200"
                  style={{ left: `${(from + to) / 2}%`, top: TRACK_Y + 30, ['--i' as string]: 12 }}
                >
                  moved {shift >= 0 ? '+' : ''}{shift} {Math.abs(shift) === 1 ? 'day' : 'days'}
                </span>
              </div>
            )
          })}

          {/* Today needle */}
          <div aria-hidden="true" className="absolute top-0 w-px bg-indigo-500/70" style={{ left: `${todayX}%`, height: TRACK_Y + 40 }} />
          <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 rounded-full bg-indigo-600 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-white"
            style={{ left: `${todayX}%`, top: TRACK_Y + 44 }}
          >
            Now
          </span>
          <span
            aria-hidden="true"
            className="pulse absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-4 ring-white"
            style={{ left: `${todayX}%`, top: TRACK_Y }}
          />

          {/* Pins */}
          <ol className="contents">
            {pins.map(({ a, px, lane, right }, i) => {
              const t = courseTheme(a.course_id)
              const done = progress[a.id] === 'completed'
              const late = !done && new Date(a.current_deadline).getTime() < now.getTime()
              const short = a.title.split(':')[0]
              const top = lane >= 0 ? LANES[lane] : null
              return (
                <li key={a.id} className="rise" style={{ ['--i' as string]: i + 2 }}>
                  {top !== null && (
                    <span
                      aria-hidden="true"
                      className="absolute w-px"
                      style={{ left: `${px}%`, top: top + CHIP_H, height: TRACK_Y - top - CHIP_H, background: t.dot, opacity: 0.35 }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ${late ? 'ring-rose-200' : 'ring-white'}`}
                    style={{ left: `${px}%`, top: TRACK_Y, background: done ? '#c4c4d2' : t.dot }}
                  />
                  <Link
                    to={`/assignments/${a.id}`}
                    aria-label={`${a.title}, ${a.courses?.name}, due ${formatShort(a.current_deadline)}${done ? ', completed' : late ? ', overdue' : ''}`}
                    title={a.title}
                    className={`absolute flex max-w-[11rem] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold shadow-[0_1px_2px_rgba(25,25,39,.06)] ring-1 ring-inset hover:brightness-[0.97] ${
                      top === null ? 'h-5 w-5 -translate-x-1/2 -translate-y-1/2 !px-0 opacity-0 focus:opacity-100' : ''
                    } ${done ? 'opacity-55' : ''}`}
                    style={{
                      left: `${px}%`,
                      top: top ?? TRACK_Y,
                      height: top === null ? undefined : CHIP_H,
                      transform: top === null ? undefined : right ? 'translateX(-100%)' : 'translateX(-6px)',
                      background: t.bg,
                      color: t.text,
                      ['--tw-ring-color' as string]: `${t.dot}33`,
                    }}
                  >
                    {top !== null && (
                      <>
                        {done && <Check size={12} aria-hidden="true" />}
                        <span className="truncate">{short}</span>
                        <span className="shrink-0 font-mono text-[10px] font-medium opacity-70">
                          {new Date(a.current_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              )
            })}
          </ol>

          {/* Day labels */}
          {ticks.map((d, i) => {
            const isToday = dayKey(d) === todayKey
            return (
              <div
                key={`l${i}`}
                aria-hidden="true"
                className="absolute text-center"
                style={{ left: `${(i / days) * 100}%`, width: `${100 / days}%`, top: TRACK_Y + 70 }}
              >
                <div className={`font-mono text-[10px] uppercase tracking-wider ${isToday ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {d.toLocaleDateString('en-GB', { weekday: 'narrow' })}
                </div>
                <div className={`tnum text-xs font-semibold ${isToday ? 'text-indigo-700' : 'text-slate-600'}`}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
