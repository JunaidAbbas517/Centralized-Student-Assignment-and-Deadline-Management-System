import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import { Card, ErrorText, input, PageHeader, Segmented } from '../components/ui'
import { isOverdue } from '../lib/dates'
import { saveProgress } from '../lib/progress'
import { useAssignments } from '../lib/useAssignments'

type Tab = 'all' | 'open' | 'overdue' | 'completed'

export default function Assignments() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'student'
  const { assignments, progress, changed, loading, error, reload } = useAssignments(role)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')

  if (loading) return <p>Loading…</p>
  const done = (id: string) => progress[id] === 'completed'

  const rows = assignments
    .filter((a) => {
      if (role === 'instructor' || tab === 'all') return true
      if (tab === 'completed') return done(a.id)
      if (tab === 'overdue') return !done(a.id) && isOverdue(a.current_deadline)
      return !done(a.id)
    })
    .filter((a) => `${a.title} ${a.courses?.name}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader title="Assignments">
        <input className={`${input} w-56`} placeholder="Search assignments" aria-label="Search assignments" value={query} onChange={(e) => setQuery(e.target.value)} />
        {role === 'student' && (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All' }, { value: 'open', label: 'Open' },
              { value: 'overdue', label: 'Overdue' }, { value: 'completed', label: 'Completed' },
            ]}
          />
        )}
      </PageHeader>
      <ErrorText message={error} />
      <Card className="!p-0">
        <AssignmentTable
          rows={rows}
          progress={progress}
          changed={changed}
          role={role}
          empty="No assignments match."
          onStatus={async (a, s) => {
            if (!profile) return
            await saveProgress(profile.id, a.id, s)
            await reload()
          }}
        />
      </Card>
    </div>
  )
}
