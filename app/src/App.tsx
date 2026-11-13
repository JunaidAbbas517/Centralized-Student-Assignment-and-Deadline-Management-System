import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Card } from './components/ui'
import { isConfigured } from './lib/supabase'
import AssignmentDetail from './pages/AssignmentDetail'
import Assignments from './pages/Assignments'
import History from './pages/History'
import CalendarPage from './pages/Calendar'
import CourseDetail from './pages/CourseDetail'
import Courses from './pages/Courses'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Account from './pages/Account'
import ResetPassword from './pages/ResetPassword'

function Splash({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-slate-500">{text}</p>
    </div>
  )
}

function Gate() {
  const { session, profile, loading, recovering } = useAuth()
  if (loading) return <Splash text="Loading…" />
  if (!session) return <Login />
  if (recovering) return <ResetPassword />
  if (!profile) return <Splash text="Loading your profile…" />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="account" element={<Account />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="history" element={<History />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="p-6">
        <Card>
          <h1 className="mb-2 text-lg font-bold">Supabase is not configured</h1>
          <p className="text-sm">
            Copy <code>.env.example</code> to <code>.env</code> and set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
          </p>
        </Card>
      </div>
    )
  }
  // HashRouter keeps routing working on GitHub Pages without server-side rewrites.
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}
