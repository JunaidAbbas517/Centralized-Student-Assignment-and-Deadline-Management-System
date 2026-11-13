import { useAuth } from '../auth/AuthContext'
import { Environment } from '../components/Layout'
import { BrandMark, btnGhost, Card } from '../components/ui'
import { supabase } from '../lib/supabase'
import { PasswordForm } from './Account'

/** Shown after the user opens a password-reset email link. */
export default function ResetPassword() {
  const { session, endRecovery } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <Environment />
      <div className="rise w-full max-w-[26rem]">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">DeadlineHub</span>
        </div>
        <Card>
          <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight">Choose a new password</h1>
          <p className="mb-6 mt-1.5 text-sm text-slate-500">
            For {session?.user.email}. You will stay logged in after saving.
          </p>
          <PasswordForm submitLabel="Save and continue" onDone={endRecovery} />
        </Card>
        <button
          className={`${btnGhost} mt-4 w-full`}
          onClick={() => {
            endRecovery()
            void supabase.auth.signOut()
          }}
        >
          Cancel and log out
        </button>
      </div>
    </div>
  )
}
