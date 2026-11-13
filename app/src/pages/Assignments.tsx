import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AssignmentTable from '../components/AssignmentTable'
import { Card, ErrorText, input, PageHeader, Segmented } from '../components/ui'
import { setStarted } from '../lib/progress'
import { useAssignments } from '../lib/useAssignments'
import { isOpen } from '../lib/workStatus'

type Tab = 'all' | 'todo' | 'missing' | 'submitted' | 'graded'

export default function Assignments() {
  const { profile } = useAuth()
  const role = profile?.role === 'instructor' ? 'instructor' : 'student'
  const { assignments, work, classWork, changed, loading, error, reload } = useAssignments(role)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')

  if (loading) return <p>Loading…</p>

  const rows = assignments
    .filter((a) => {
      const s = work[a.id]?.state
      if (role === 'instructor' || tab === 'all') return true
      if (tab === 'todo') return isOpen(s) && s !== 'missing'
      if (tab === 'missing') return s === 'missing' || s === 'closed'
      if (tab === 'submitted') return s === 'submitted' || s === 'submitted_late'
      return s === 'graded'
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
              { value: 'all', label: 'All' }, { value: 'todo', label: 'To do' }, { value: 'missing', label: 'Missing' },
              { value: 'submitted', label: 'Submitted' }, { value: 'graded', label: 'Graded' },
            ]}
          />
        )}
      </PageHeader>
      <ErrorText message={error} />
      <Card className="!p-0">
        <AssignmentTable
          rows={rows}
          work={work}
          classWork={classWork}
          changed={changed}
          role={role}
          empty="No assignments match."
          onStart={async (a) => {
            if (!profile) return
            await setStarted(profile.id, a.id, true)
            await reload()
          }}
        />
      </Card>
    </div>
  )
}
