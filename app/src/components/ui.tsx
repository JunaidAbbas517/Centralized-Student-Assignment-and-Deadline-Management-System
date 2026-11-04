import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProgressStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'

export const btn =
  'tap inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_16px_-6px_rgba(84,67,204,.55)] hover:bg-indigo-700 disabled:opacity-50'
export const btnGhost =
  'tap inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(25,25,39,.04)] hover:border-slate-300 hover:bg-white disabled:opacity-50'
export const input =
  'tap w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100'

/** Small mono label, used for eyebrows, column heads and timestamps. */
export const label = 'font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500'

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={`rounded-[20px] border border-slate-200/80 bg-[var(--panel)] p-6 shadow-[0_1px_2px_rgba(25,25,39,.04),0_12px_32px_-18px_rgba(25,25,39,.18)] ${className}`}
    >
      {children}
    </div>
  )
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-rose-700">{message}</p> : null
}

/** The DeadlineHub mark: a deadline moved along a dashed arc. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M8 21c3-8 13-8 16 0" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3" opacity=".9" />
      <circle cx="8" cy="21" r="2.4" fill="none" stroke="white" strokeWidth="1.6" opacity=".7" />
      <circle cx="24" cy="21" r="3" fill="white" />
    </svg>
  )
}

// ---------- Course colours ----------

export interface Theme { dot: string; bg: string; text: string }

const PALETTE: Theme[] = [
  { dot: '#3d63dd', bg: '#e9eefd', text: '#2a47a8' },
  { dot: '#2e9d72', bg: '#e3f4ec', text: '#1e6b4d' },
  { dot: '#e0693b', bg: '#fdede5', text: '#a2431d' },
  { dot: '#8c5bd8', bg: '#f1eafc', text: '#613a9f' },
  { dot: '#d2477b', bg: '#fce8ef', text: '#962c55' },
  { dot: '#1c97a8', bg: '#e1f3f5', text: '#146b77' },
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
  const t = courseTheme(courseId)
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ background: t.dot, boxShadow: `0 0 0 3px ${t.bg}` }}
    />
  )
}

// ---------- Pills ----------

type Tone = 'overdue' | 'in_progress' | 'pending' | 'completed' | 'changed' | 'neutral'
const TONES: Record<Tone, string> = {
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
  in_progress: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  pending: 'bg-white text-slate-600 ring-slate-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  changed: 'bg-orange-50 text-orange-700 ring-orange-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>
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
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        className="tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 ring-1 ring-inset ring-transparent hover:bg-white hover:text-slate-900 hover:ring-slate-200 aria-expanded:bg-white aria-expanded:text-slate-900 aria-expanded:ring-slate-200"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Update status <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" className="fade absolute right-0 z-20 mt-1.5 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(25,25,39,.25)]">
          {(Object.keys(STATUS_LABEL) as ProgressStatus[]).map((s) => (
            <li key={s} role="none">
              <button
                role="menuitem"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 ${s === value ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}
                onClick={() => {
                  setOpen(false)
                  onChange(s)
                }}
              >
                {STATUS_LABEL[s]}
                {s === value && <span aria-hidden="true">✓</span>}
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
    <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200/70">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 text-sm font-medium ${
            o.value === value ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(25,25,39,.12)]' : 'text-slate-500 hover:text-slate-800'
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
    <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className={`${label} mb-1.5`}>{eyebrow}</p>}
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
      {aside}
    </div>
  )
}

export function firstName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter((p) => p && !p.endsWith('.'))
  return parts[0] ?? fullName
}
