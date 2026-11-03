import { useState, type FormEvent } from 'react'
import { isDemo, supabase } from '../lib/supabase'
import { btn, btnGhost, Card, ErrorText, input } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Account created. Check your email to confirm, then log in.')
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold text-indigo-700">DeadlineHub</h1>
        <p className="mb-4 text-sm text-slate-600">
          {mode === 'login' ? 'Log in to continue' : 'Create a student account'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block text-sm">Full name
              <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
          )}
          <label className="block text-sm">Email
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm">Password
            <input className={input} type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <ErrorText message={error} />
          {info && <p className="text-sm text-green-700">{info}</p>}
          <button className={`${btn} w-full`} disabled={busy}>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        </form>
        <button
          className="mt-3 text-sm text-indigo-700 underline"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
        {mode === 'signup' && (
          <p className="mt-2 text-xs text-slate-500">Instructor accounts are granted by the system maintainer.</p>
        )}
        {isDemo && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Design preview (sample data)</p>
            <div className="flex gap-2">
              {[['Student', 'student@demo.edu'], ['Instructor', 'instructor@demo.edu']].map(([label, demoEmail]) => (
                <button
                  key={demoEmail}
                  type="button"
                  className={`${btnGhost} flex-1`}
                  onClick={() => void supabase.auth.signInWithPassword({ email: demoEmail, password: 'demo' })}
                >
                  View as {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
