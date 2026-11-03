import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ProgressStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'

export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50'
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'
export const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-red-600">{message}</p> : null
}

// ---------- Course colours ----------

interface Theme { dot: string; bg: string; text: string }

const PALETTE: Theme[] = [
  { dot: '#2563eb', bg: '#dbeafe', text: '#1e40af' },
  { dot: '#16a34a', bg: '#dcfce7', text: '#166534' },
  { dot: '#ea580c', bg: '#ffedd5', text: '#9a3412' },
  { dot: '#9333ea', bg: '#f3e8ff', text: '#6b21a8' },
  { dot: '#db2777', bg: '#fce7f3', text: '#9d174d' },
  { dot: '#0d9488', bg: '#ccfbf1', text: '#115e59' },
]
const registry = new Map<string, number>()

/** Fixes colour order for a set of courses so the same course keeps its colour everywhere. */
export function registerCourses(ids: string[]) {
  for (const id of ids) if (!registry.has(id)) registry.set(id, registry.size)
}

export function courseTheme(courseId: string): Theme {
  if (!registry.has(courseId)) registry.set(courseId, registry.size)
  return PALETTE[(registry.get(courseId) as number) % PALETTE.length]
}

export function CourseDot({ courseId, className = '' }: { courseId: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ background: courseTheme(courseId).dot }}
    />
  )
}

// ---------- Pills ----------

type Tone = 'overdue' | 'in_progress' | 'pending' | 'completed' | 'changed' | 'neutral'
const TONES: Record<Tone, string> = {
  overdue: 'bg-red-100 text-red-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  pending: 'bg-slate-100 text-slate-600',
  completed: 'bg-green-100 text-green-700',
  changed: 'bg-orange-100 text-orange-700',
  neutral: 'bg-slate-100 text-slate-600',
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: ProgressStatus }) {
  return <Pill tone={status}>{STATUS_LABEL[status]}</Pill>
}

// ---------- Status menu ----------

export function StatusMenu({ value, onChange }: { value: ProgressStatus; onChange: (s: ProgressStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button className={btnGhost} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Update status
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {(Object.keys(STATUS_LABEL) as ProgressStatus[]).map((s) => (
            <li key={s} role="none">
              <button
                role="menuitem"
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${s === value ? 'font-semibold text-indigo-700' : ''}`}
                onClick={() => {
                  setOpen(false)
                  onChange(s)
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Segmented control ----------

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 text-sm font-medium ${
            o.value === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm text-slate-500">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function firstName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter((p) => p && !p.endsWith('.'))
  return parts[0] ?? fullName
}
