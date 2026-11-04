import { useCallback, useEffect, useState } from 'react'
import { BellRing, CalendarPlus, CheckCheck, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { btnGhost, Card, courseTheme, ErrorText, PageHeader } from '../components/ui'
import { whenLabel } from '../lib/dates'
import { notifyNotificationsChanged } from '../lib/progress'
import { supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'
import { LoadingState } from './Dashboard'

type Row = Notification & { assignments: { title: string; course_id: string; courses: { name: string } | null } | null }

const ICONS = { deadline_changed: RefreshCw, reminder: BellRing, new_assignment: CalendarPlus } as const

export default function Notifications() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, assignments(title, course_id, courses(name))')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) setError(error.message)
    setItems((data ?? []) as unknown as Row[])
    setLoading(false)
    notifyNotificationsChanged()
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    void load()
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    void load()
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={unread ? `${unread} unread` : 'All caught up'} title="Notifications">
        {unread > 0 && <button className={btnGhost} onClick={markAllRead}><CheckCheck size={16} /> Mark all as read</button>}
      </PageHeader>
      <ErrorText message={error} />
      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <Card className="text-center text-slate-500">No notifications yet. Deadline changes show up here.</Card>
      ) : (
        <Card className="rise !p-0 overflow-hidden" style={{ ['--i' as string]: 1 }}>
          <ul>
            {items.map((n) => {
              const Icon = ICONS[n.type as keyof typeof ICONS] ?? BellRing
              const t = n.assignments ? courseTheme(n.assignments.course_id) : null
              return (
                <li key={n.id} className={`relative flex gap-4 border-b border-slate-100 px-6 py-4 last:border-b-0 ${n.is_read ? '' : 'bg-indigo-50/30'}`}>
                  {!n.is_read && <span aria-hidden="true" className="absolute left-0 top-0 h-full w-[3px] bg-indigo-600" />}
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: t?.bg ?? '#eeeef3', color: t?.text ?? '#535368' }}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm leading-snug ${n.is_read ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                      {!n.is_read && <span className="sr-only">Unread: </span>}
                      {n.message}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {n.assignments?.courses?.name ? `${n.assignments.courses.name} · ` : ''}{whenLabel(n.created_at)}
                    </div>
                    <div className="mt-2 flex gap-4 text-sm">
                      {n.assignment_id && (
                        <Link className="font-semibold text-indigo-700 hover:text-indigo-800" to={`/assignments/${n.assignment_id}`} onClick={() => void markRead(n.id)}>
                          Open assignment
                        </Link>
                      )}
                      {!n.is_read && (
                        <button className="font-medium text-slate-500 hover:text-slate-900" onClick={() => void markRead(n.id)}>Mark as read</button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
