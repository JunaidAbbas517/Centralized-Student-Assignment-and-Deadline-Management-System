import { Lock } from 'lucide-react'
import { formatDayTime, formatStamp } from '../lib/dates'
import type { DeadlineChange } from '../lib/types'

/** Append-only deadline history: newest change first, the original publication last. */
export default function DeadlineTimeline({ changes, currentDeadline, createdAt, people }: {
  changes: DeadlineChange[]
  currentDeadline: string
  createdAt: string
  people: Record<string, string>
}) {
  const original = changes.length ? changes[changes.length - 1].previous_deadline : currentDeadline
  return (
    <div>
      <ol className="relative space-y-5 text-sm before:absolute before:bottom-3 before:left-[4.5px] before:top-2 before:w-px before:bg-slate-200">
        {changes.map((c) => (
          <li key={c.id} className="relative flex gap-3.5">
            <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 ring-4 ring-orange-100" />
            <div className="min-w-0">
              <div className="tnum font-semibold text-slate-900">
                <s className="font-medium text-slate-400">{formatDayTime(c.previous_deadline)}</s>
                <span className="mx-1.5 text-slate-400">→</span>
                {formatDayTime(c.new_deadline)}
              </div>
              {c.reason && <p className="mt-1 leading-relaxed text-slate-600">“{c.reason}”</p>}
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                {people[c.changed_by] ?? 'Instructor'} · {formatStamp(c.changed_at)}
              </div>
            </div>
          </li>
        ))}
        <li className="relative flex gap-3.5">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300 ring-4 ring-slate-100" />
          <div>
            <div className="tnum font-semibold text-slate-900">Published, due {formatDayTime(original)}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">{formatStamp(createdAt)}</div>
          </div>
        </li>
      </ol>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock size={12} aria-hidden="true" /> History entries are permanent and cannot be edited.
      </p>
    </div>
  )
}
