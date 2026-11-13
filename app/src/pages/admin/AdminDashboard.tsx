import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, FileText, GraduationCap, History, Presentation, ShieldCheck, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Card, ErrorText, label, Pill, SectionTitle } from '../../components/ui'
import { formatDay, formatLongDate, greeting } from '../../lib/dates'
import { LoadingState } from '../Dashboard'
import { Avatar, InstructorActions, RolePill } from './AdminUsers'
import { useAdminData } from './adminData'

function Tile({ icon: Icon, value, caption, sub, highlight, i }: {
  icon: LucideIcon; value: number; caption: string; sub: string; highlight?: boolean; i: number
}) {
  return (
    <Card
      className={`rise !p-5 ${highlight ? '!border-orange-200 !bg-orange-50/60' : ''}`}
      style={{ ['--i' as string]: i }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`text-sm font-semibold ${highlight ? 'text-orange-800' : 'text-slate-700'}`}>{caption}</div>
        <Icon size={18} className={highlight ? 'text-orange-500' : 'text-slate-400'} aria-hidden="true" />
      </div>
      <div className="tnum mt-3 font-display text-[2.4rem] font-semibold leading-none text-slate-900">{value}</div>
      <div className="mt-2 truncate text-xs text-slate-500">{sub}</div>
    </Card>
  )
}

function Mini({ icon: Icon, value, caption }: { icon: LucideIcon; value: number; caption: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--panel)] px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="tnum font-display text-xl font-semibold leading-none text-slate-900">{value}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{caption}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { stats, people, error, loading, reload } = useAdminData()

  if (loading) return <LoadingState />
  const s = stats
  const pending = people.filter((p) => p.role === 'instructor' && p.status === 'pending')
  const newest = people.filter((p) => p.id !== profile?.id).slice(0, 6)

  return (
    <>
      <div className="rise mb-7">
        <p className={`${label} mb-1.5`}>{formatLongDate()}</p>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-slate-900">
          {greeting()}, {profile?.full_name || 'Admin'}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-600">
          {s && s.pending > 0
            ? `${s.pending} instructor ${s.pending === 1 ? 'account is' : 'accounts are'} waiting for your verification.`
            : 'Everything is verified. Here is how the platform is doing.'}
        </p>
      </div>

      <ErrorText message={error} />

      {s && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile i={1} icon={GraduationCap} value={s.students} caption="Total students" sub={`${s.enrollments} course enrollments`} />
            <Tile i={2} icon={Presentation} value={s.instructors} caption="Instructors" sub={s.rejected ? `${s.rejected} rejected` : 'Verified and active'} />
            <Tile i={3} icon={ShieldCheck} value={s.pending} caption="Awaiting verification" sub={s.pending ? 'Review below' : 'Nothing to review'} highlight={s.pending > 0} />
            <Tile i={4} icon={BookOpen} value={s.courses} caption="Active courses" sub={s.archived_courses ? `${s.archived_courses} archived` : 'None archived'} />
          </div>

          <Card className="rise mt-4 !p-0 overflow-hidden" style={{ ['--i' as string]: 5 }}>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
              <Mini icon={FileText} value={s.assignments} caption="Assignments" />
              <Mini icon={CalendarClock} value={s.upcoming} caption="Upcoming" />
              <Mini icon={History} value={s.deadline_changes} caption="Date changes" />
              <Mini icon={CheckCircle2} value={s.completed} caption="Completed tasks" />
              <Mini icon={UserPlus} value={s.new_users_7d} caption="New this week" />
            </div>
          </Card>
        </>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rise" style={{ ['--i' as string]: 6 }}>
          <SectionTitle
            aside={<Link to="/instructors" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800">All requests <ArrowRight size={14} aria-hidden="true" /></Link>}
          >
            Needs verification
          </SectionTitle>
          <Card className="!p-0 overflow-hidden">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle2 size={22} className="text-emerald-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-800">All caught up</p>
                <p className="text-sm text-slate-500">New instructor sign-ups will appear here.</p>
              </div>
            ) : (
              <ul>
                {pending.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={p.full_name || p.email} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{p.full_name || 'No name'}</div>
                        <div className="truncate text-sm text-slate-500">{p.email} · signed up {p.created_at ? formatDay(p.created_at) : ''}</div>
                      </div>
                    </div>
                    <InstructorActions p={p} onDone={reload} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="rise" style={{ ['--i' as string]: 7 }}>
          <SectionTitle
            aside={<Link to="/users" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800">All users <ArrowRight size={14} aria-hidden="true" /></Link>}
          >
            Newest accounts
          </SectionTitle>
          <Card className="!p-0 overflow-hidden">
            {newest.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No one has signed up yet.</p>
            ) : (
              <ul>
                {newest.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0">
                    <Avatar name={p.full_name || p.email} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{p.full_name || p.email}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.created_at ? formatDay(p.created_at) : ''}</div>
                    </div>
                    <RolePill p={p} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {s && (
        <section className="rise mt-8" style={{ ['--i' as string]: 8 }}>
          <SectionTitle aside={<span className="font-mono text-xs text-slate-500">{s.course_list.length} total</span>}>Courses</SectionTitle>
          <Card className="!p-0 overflow-hidden">
            {s.course_list.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No courses have been created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th scope="col" className="px-6 py-2.5 font-medium">Course</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Instructor</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium"><Users size={13} className="mr-1 inline" aria-hidden="true" />Students</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Assignments</th>
                      <th scope="col" className="px-6 py-2.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.course_list.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{c.course_code}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{c.instructor}</td>
                        <td className="tnum px-4 py-3.5 text-right font-medium text-slate-900">{c.students}</td>
                        <td className="tnum px-4 py-3.5 text-right font-medium text-slate-900">{c.assignments}</td>
                        <td className="px-6 py-3.5 text-right">{c.archived ? <Pill tone="neutral">Archived</Pill> : <Pill tone="completed">Active</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}
    </>
  )
}
