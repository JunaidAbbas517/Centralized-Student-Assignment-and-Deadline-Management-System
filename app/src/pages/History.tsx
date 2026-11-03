import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CourseDot, ErrorText, PageHeader } from '../components/ui'
import { formatDayTime, formatStamp } from '../lib/dates'
import { supabase } from '../lib/supabase'

interface Row {
  id: string
  assignment_id: string
  previous_deadline: string
  new_deadline: string
  changed_by: string
  reason: string | null
  changed_at: string
  assignments: { title: string; course_id: string; courses: { name: string } | null } | null
}

export default function History() {
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await supabase
        .from('deadline_changes')
        .select('*, assignments(title, course_id, courses(name))')
        .order('changed_at', { ascending: false })
      if (r.error) setError(r.error.message)
      setRows((r.data ?? []) as unknown as Row[])
      const p = await supabase.from('profiles').select('id, full_name')
      const names: Record<string, string> = {}
      for (const x of (p.data ?? []) as { id: string; full_name: string }[]) names[x.id] = x.full_name
      setPeople(names)
      setLoading(false)
    })()
  }, [])

  return (
    <div>
      <PageHeader title="Deadline history" />
      <ErrorText message={error} />
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-600">No deadline has been changed yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  {r.assignments && <CourseDot courseId={r.assignments.course_id} />}
                  {r.assignments?.courses?.name}
                  <span className="ml-auto">{formatStamp(r.changed_at)}</span>
                </div>
                <Link to={`/assignments/${r.assignment_id}`} className="mt-1 block text-lg font-bold hover:text-indigo-700">
                  {r.assignments?.title}
                </Link>
                <div className="mt-1 text-sm">
                  <s className="text-slate-500">{formatDayTime(r.previous_deadline)}</s> → <strong>{formatDayTime(r.new_deadline)}</strong>
                </div>
                {r.reason && <div className="mt-1 text-sm text-slate-600">“{r.reason}”</div>}
                <div className="mt-1 text-xs text-slate-500">Changed by {people[r.changed_by] ?? 'instructor'}</div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock size={12} /> History entries are permanent and cannot be edited.
      </p>
    </div>
  )
}
