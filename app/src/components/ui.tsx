import type { ReactNode } from 'react'
import type { ProgressStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'

export const btn =
  'rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50'
export const btnGhost =
  'rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50'
export const input = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-red-600">{message}</p> : null
}

const COURSE_COLORS = [
  'bg-sky-100 border-sky-400 text-sky-900',
  'bg-emerald-100 border-emerald-400 text-emerald-900',
  'bg-amber-100 border-amber-400 text-amber-900',
  'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900',
  'bg-rose-100 border-rose-400 text-rose-900',
  'bg-teal-100 border-teal-400 text-teal-900',
]

/** Stable colour per course. The course code is always shown too, so colour is never the only cue. */
export function courseColor(courseId: string): string {
  let h = 0
  for (const ch of courseId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COURSE_COLORS[h % COURSE_COLORS.length]
}

export function StatusBadge({ status }: { status: ProgressStatus }) {
  const style =
    status === 'completed'
      ? 'bg-green-100 text-green-800'
      : status === 'in_progress'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-slate-100 text-slate-700'
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${style}`}>{STATUS_LABEL[status]}</span>
}
