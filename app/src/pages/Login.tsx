import { useState, type FormEvent } from 'react'
import { GraduationCap, Presentation } from 'lucide-react'
import { appUrl, isDemo, supabase } from '../lib/supabase'
import { Environment } from '../components/Layout'
import { BrandMark, btn, ErrorText, input, label } from '../components/ui'

/** A small drawn version of the dashboard ribbon, used as the login artwork. */
function RibbonArt() {
  const pins = [
    { x: 14, c: '#8676e4', done: true },
    { x: 31, c: '#2e9d72' },
    { x: 43, c: '#3d63dd' },
    { x: 86, c: '#e0693b' },
  ]
  return (
    <svg viewBox="0 0 100 40" className="w-full" aria-hidden="true">
      {Array.from({ length: 15 }, (_, i) => (
        <line key={i} x1={i * 7.1 + 1} x2={i * 7.1 + 1} y1="2" y2="30" stroke="white" strokeOpacity=".06" strokeWidth=".2" />
      ))}
      <line x1="0" x2="100" y1="20" y2="20" stroke="white" strokeOpacity=".18" strokeWidth=".4" />
      <line x1="0" x2="24" y1="20" y2="20" stroke="white" strokeOpacity=".5" strokeWidth=".4" />
      <line x1="24" x2="24" y1="2" y2="30" stroke="#a99eee" strokeWidth=".3" />
      <path d="M 64 20 C 64 34, 86 34, 86 20" fill="none" stroke="#e0693b" strokeWidth=".5" strokeDasharray="1.2 1.2" strokeLinecap="round" />
      <circle cx="64" cy="20" r="1.3" fill="#191927" stroke="#e0693b" strokeWidth=".35" strokeDasharray=".6 .5" />
      {pins.map((p) => (
        <circle key={p.x} cx={p.x} cy="20" r="1.5" fill={p.done ? '#6b6b80' : p.c} stroke="#191927" strokeWidth=".6" />
      ))}
      <circle cx="24" cy="20" r="1.2" fill="#a99eee" />
    </svg>
  )
}

type Mode = 'login' | 'signup' | 'forgot'

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: 'Welcome back', sub: 'Log in to see your courses and deadlines.', cta: 'Log in' },
  signup: {
    title: 'Create your account',
    sub: 'New accounts start as students. Your instructor gives you a course code.',
    cta: 'Create account',
  },
  forgot: { title: 'Reset your password', sub: 'We will email you a link to choose a new one.', cta: 'Send reset link' },
}

/** Supabase reports expired or invalid email links in the URL (?error_description=…). */
function linkError(): string | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''))
    const msg = q.get('error_description') ?? h.get('error_description')
    return msg ? `${msg.replace(/\+/g, ' ')}. Request a new link below.` : null
  } catch {
    return null
  }
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match an account.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  return message
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(linkError)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(friendly(error.message))
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: appUrl() },
      })
      if (error) setError(friendly(error.message))
      else if (!data.session) {
        setInfo(`Account created. We sent a confirmation link to ${email}. Open it in this browser to finish.`)
        setPassword('')
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('?reset=1') })
      if (error) setError(friendly(error.message))
      // Same message whether or not the account exists, so emails cannot be probed.
      else setInfo(`If ${email} has an account, a reset link is on its way. Open it in this browser.`)
    }
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <Environment />

      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[#191927] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(134,118,228,.35),transparent)]" />
        <div aria-hidden="true" className="absolute -bottom-48 -left-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(28,151,168,.18),transparent)]" />
        <div className="relative flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">DeadlineHub</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="rise font-mono text-[11px] uppercase tracking-[0.12em] text-indigo-300">For students and instructors</p>
          <h1 className="rise mt-4 text-[3.1rem] font-semibold leading-[1.02] tracking-[-0.035em]" style={{ ['--i' as string]: 1 }}>
            Every deadline in one place. Every change on the record.
          </h1>
          <p className="rise mt-5 max-w-[46ch] text-[15px] leading-relaxed text-slate-300" style={{ ['--i' as string]: 2 }}>
            Instructors publish once. When a date moves, every enrolled student sees the new one, and the old one stays in the history.
          </p>
          <div className="rise mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur" style={{ ['--i' as string]: 3 }}>
            <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
              <span>The next two weeks</span>
              <span className="text-orange-300">Moved +4 days</span>
            </div>
            <RibbonArt />
          </div>
        </div>
        <p className="relative mt-10 text-xs text-slate-500">Intelligent Software Engineering · Course project</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="rise w-full max-w-[24rem]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-display text-lg font-semibold tracking-tight">DeadlineHub</span>
          </div>
          <h2 className="text-[1.9rem] font-semibold leading-tight tracking-tight">{COPY[mode].title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{COPY[mode].sub}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <label className="block text-sm font-medium text-slate-700">Full name
                <input className={`${input} mt-1.5`} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">Email
              <input className={`${input} mt-1.5`} type="email" autoComplete="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button type="button" className="text-xs font-medium text-indigo-700 hover:text-indigo-800" onClick={() => switchMode('forgot')}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  className={`${input} mt-1.5`}
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <ErrorText message={error} />
            {info && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">{info}</p>}
            <button className={`${btn} w-full !py-2.5`} disabled={busy}>
              {busy ? 'One moment…' : COPY[mode].cta}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            {mode === 'login' ? 'New here?' : mode === 'signup' ? 'Already have an account?' : 'Remembered it?'}{' '}
            <button className="font-semibold text-indigo-700 hover:text-indigo-800" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>

          {isDemo && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className={label}>Design preview</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Student', 'student@demo.edu', GraduationCap, 'Alex Chen'],
                  ['Instructor', 'instructor@demo.edu', Presentation, 'Dr. Wang Lin'],
                ] as const).map(([role, demoEmail, Icon, who]) => (
                  <button
                    key={demoEmail}
                    type="button"
                    className="tap group rounded-2xl border border-slate-200 bg-white/80 p-3.5 text-left hover:border-indigo-200 hover:bg-white hover:shadow-[0_8px_24px_-14px_rgba(84,67,204,.45)]"
                    onClick={() => void supabase.auth.signInWithPassword({ email: demoEmail, password: 'demo' })}
                  >
                    <Icon size={18} className="text-slate-400 group-hover:text-indigo-600" aria-hidden="true" />
                    <div className="mt-2 text-sm font-semibold text-slate-900">View as {role}</div>
                    <div className="text-xs text-slate-500">{who}, sample data</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
