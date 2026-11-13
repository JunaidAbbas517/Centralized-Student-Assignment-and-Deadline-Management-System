import { Clock, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Environment } from '../components/Layout'
import { BrandMark, btn, btnGhost, Card } from '../components/ui'
import { supabase } from '../lib/supabase'

/** Shown to instructors whose account an admin has not approved (or has rejected). */
export default function PendingApproval() {
  const { profile, refreshProfile } = useAuth()
  const [checking, setChecking] = useState(false)
  const rejected = profile?.status === 'rejected'
  const Icon = rejected ? ShieldX : Clock

  async function check() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <Environment />
      <div className="rise w-full max-w-[28rem]">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">DeadlineHub</span>
        </div>
        <Card>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${rejected ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
            <Icon size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-[1.6rem] font-semibold leading-tight tracking-tight">
            {rejected ? 'Instructor access was not approved' : 'Waiting for admin approval'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {rejected
              ? 'An admin reviewed your instructor account and did not approve it. Contact the course administrator if you think this is a mistake.'
              : `Thanks, ${profile?.full_name || 'there'}. Your instructor account is set up. An admin needs to verify it before you can create courses and publish assignments.`}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-inset ring-slate-100">
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">Account</dt>
              <dd className="mt-0.5 truncate font-medium text-slate-800">{profile?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className={`mt-0.5 font-medium ${rejected ? 'text-rose-700' : 'text-indigo-700'}`}>{rejected ? 'Not approved' : 'Pending review'}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {!rejected && (
              <button className={btn} onClick={check} disabled={checking}>
                {checking ? 'Checking…' : 'Check again'}
              </button>
            )}
            <button className={btnGhost} onClick={() => void supabase.auth.signOut()}>Log out</button>
          </div>
        </Card>
      </div>
    </div>
  )
}
