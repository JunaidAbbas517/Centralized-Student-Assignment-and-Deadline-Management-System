import { useState, type FormEvent } from 'react'
import { Check, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { btn, btnGhost, Card, ErrorText, input, label, PageHeader } from '../components/ui'
import { supabase } from '../lib/supabase'

function Saved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
      <Check size={15} aria-hidden="true" /> Saved
    </span>
  ) : null
}

function NameForm() {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setError(null)
    setSaved(false)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id)
    if (error) setError(error.message)
    else {
      await refreshProfile()
      setSaved(true)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">Full name
        <input className={`${input} mt-1.5`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <p className="text-xs text-slate-500">Shown to your instructors and in course lists.</p>
      <ErrorText message={error} />
      <div className="flex items-center gap-3">
        <button className={btn} disabled={busy || name.trim() === (profile?.full_name ?? '')}>{busy ? 'Saving…' : 'Save name'}</button>
        <Saved show={saved} />
      </div>
    </form>
  )
}

export function PasswordForm({ onDone, submitLabel = 'Update password' }: { onDone?: () => void; submitLabel?: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    setPassword('')
    setConfirm('')
    setSaved(true)
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">New password
        <input className={`${input} mt-1.5`} type="password" autoComplete="new-password" placeholder="At least 8 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">Confirm new password
        <input className={`${input} mt-1.5`} type="password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      <ErrorText message={error} />
      <div className="flex items-center gap-3">
        <button className={btn} disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        <Saved show={saved} />
      </div>
    </form>
  )
}

export default function Account() {
  const { profile, session } = useAuth()
  const isStudent = profile?.role === 'student'

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Settings" title="Your account" />

      <div className="space-y-5">
        <Card className="rise" style={{ ['--i' as string]: 1 }}>
          <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-semibold text-slate-900">Profile</h2>
              <p className="mt-1 text-sm text-slate-500">How you appear to others.</p>
            </div>
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-100">
                <div className="min-w-0">
                  <dt className={label}>Email</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800">{profile?.email || session?.user.email}</dd>
                </div>
                <div>
                  <dt className={label}>Role</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{isStudent ? 'Student' : 'Instructor'}</dd>
                </div>
              </dl>
              <NameForm />
            </div>
          </div>
        </Card>

        <Card className="rise" style={{ ['--i' as string]: 2 }}>
          <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div>
              <h2 className="font-semibold text-slate-900">Password</h2>
              <p className="mt-1 text-sm text-slate-500">Choose a new one any time.</p>
            </div>
            <PasswordForm />
          </div>
        </Card>

        <Card className="rise" style={{ ['--i' as string]: 3 }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Sign out</h2>
              <p className="mt-1 text-sm text-slate-500">End your session on this device.</p>
            </div>
            <button className={btnGhost} onClick={() => void supabase.auth.signOut()}>
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
