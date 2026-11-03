import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { btnGhost, Card, ErrorText } from '../components/ui'
import { formatDateTime } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) setError(error.message)
    setItems((data ?? []) as Notification[])
    setLoading(false)
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

  return (
    <div>
      <div className="mb-4 flex items-center">
        <h1 className="mr-auto text-2xl font-bold">Notifications</h1>
        <button className={btnGhost} onClick={markAllRead}>Mark all as read</button>
      </div>
      <ErrorText message={error} />
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-600">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={n.is_read ? 'opacity-70' : 'border-indigo-300'}>
                <div className="flex flex-wrap items-center gap-2">
                  {!n.is_read && <span className="rounded bg-indigo-600 px-1.5 text-xs text-white">New</span>}
                  <span>{n.message}</span>
                  <span className="ml-auto text-xs text-slate-500">{formatDateTime(n.created_at)}</span>
                </div>
                <div className="mt-1 flex gap-3 text-sm">
                  {n.assignment_id && (
                    <Link className="text-indigo-700 underline" to={`/assignments/${n.assignment_id}`} onClick={() => void markRead(n.id)}>
                      View assignment
                    </Link>
                  )}
                  {!n.is_read && <button className="text-slate-600 underline" onClick={() => void markRead(n.id)}>Mark as read</button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
