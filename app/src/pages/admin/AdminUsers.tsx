import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { Card, ErrorText, PageHeader, Pill, Segmented } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import type { AccountStatus, Profile } from '../../lib/types'
import { LoadingState } from '../Dashboard'
import { initials, setInstructorStatus, useAdminData } from './adminData'

export function RolePill({ p }: { p: Profile }) {
  if (p.role === 'admin') return <Pill tone="in_progress">Admin</Pill>
  if (p.role === 'student') return <Pill tone="neutral">Student</Pill>
  if (p.status === 'pending') return <Pill tone="changed">Instructor · pending</Pill>
  if (p.status === 'rejected') return <Pill tone="overdue">Instructor · rejected</Pill>
  return <Pill tone="completed">Instructor</Pill>
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-[12px] font-semibold text-indigo-800"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

/** Approve / reject buttons for an instructor account. */
export function InstructorActions({ p, onDone }: { p: Profile; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (p.role !== 'instructor') return null

  async function set(status: AccountStatus) {
    setBusy(true)
    setError(null)
    const err = await setInstructorStatus(p.id, status)
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  const base = 'tap inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold disabled:opacity-50'
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {p.status !== 'active' && (
        <button className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={busy} onClick={() => set('active')}>
          <Check size={14} aria-hidden="true" /> Approve
        </button>
      )}
      {p.status !== 'rejected' && (
        <button
          className={`${base} text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200`}
          disabled={busy}
          onClick={() => set('rejected')}
        >
          <X size={14} aria-hidden="true" /> {p.status === 'active' ? 'Revoke' : 'Reject'}
        </button>
      )}
      {error && <span className="w-full text-right"><ErrorText message={error} /></span>}
    </div>
  )
}

type Filter = 'pending' | 'instructors' | 'students' | 'rejected' | 'all'

const MATCH: Record<Filter, (p: Profile) => boolean> = {
  pending: (p) => p.role === 'instructor' && p.status === 'pending',
  instructors: (p) => p.role === 'instructor' && p.status === 'active',
  students: (p) => p.role === 'student',
  rejected: (p) => p.role === 'instructor' && p.status === 'rejected',
  all: () => true,
}

const EMPTY: Record<Filter, string> = {
  pending: 'No instructors are waiting for verification.',
  instructors: 'No approved instructors yet.',
  students: 'No students have signed up yet.',
  rejected: 'No rejected instructor accounts.',
  all: 'No accounts yet.',
}

export default function AdminUsers({ initial = 'all' }: { initial?: Filter }) {
  const { people, error, loading, reload } = useAdminData()
  const [filter, setFilter] = useState<Filter>(initial)
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>
    for (const f of Object.keys(MATCH) as Filter[]) c[f] = people.filter(MATCH[f]).length
    return c
  }, [people])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter(MATCH[filter]).filter((p) => !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [people, filter, query])

  return (
    <>
      <PageHeader eyebrow="Admin" title={initial === 'pending' ? 'Verify instructors' : 'All users'}>
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="tap w-60 rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            placeholder="Name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </PageHeader>

      <div className="rise scroll-thin mb-4 overflow-x-auto" style={{ ['--i' as string]: 1 }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'pending', label: `Pending · ${counts.pending ?? 0}` },
            { value: 'instructors', label: `Instructors · ${counts.instructors ?? 0}` },
            { value: 'students', label: `Students · ${counts.students ?? 0}` },
            { value: 'rejected', label: `Rejected · ${counts.rejected ?? 0}` },
            { value: 'all', label: `All · ${counts.all ?? 0}` },
          ]}
        />
      </div>

      <ErrorText message={error} />
      {loading ? (
        <LoadingState />
      ) : (
        <Card className="rise !p-0 overflow-hidden" style={{ ['--i' as string]: 2 }}>
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-6 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_6rem_minmax(0,1.4fr)] md:gap-4">
            <span>Person</span>
            <span>Role</span>
            <span>Joined</span>
            <span className="text-right">Actions</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">{query ? 'No one matches that search.' : EMPTY[filter]}</p>
          ) : (
            <ul>
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 last:border-b-0 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_6rem_minmax(0,1.4fr)] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={p.full_name || p.email} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{p.full_name || 'No name'}</div>
                      <div className="truncate text-sm text-slate-500">{p.email}</div>
                    </div>
                  </div>
                  <div><RolePill p={p} /></div>
                  <div className="tnum font-mono text-xs text-slate-500">{p.created_at ? formatDay(p.created_at) : '–'}</div>
                  <InstructorActions p={p} onDone={reload} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  )
}
