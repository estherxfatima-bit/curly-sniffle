import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { TimerProvider } from './hooks/useTimer'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import WeeklyPage from './pages/WeeklyPage'
import GoalsPage from './pages/GoalsPage'
import HabitsPage from './pages/HabitsPage'
import ContentPage from './pages/ContentPage'
import InsightsPage from './pages/InsightsPage'
import PartnersPage from './pages/PartnersPage'
import AILogPage from './pages/AILogPage'
import FinancePage from './pages/FinancePage'
import WellnessPage from './pages/WellnessPage'
import SettingsPage from './pages/SettingsPage'
import BooksPage from './pages/BooksPage'
import BucketListPage from './pages/BucketListPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ComparePage from './pages/ComparePage'
import CalendarPage from './pages/CalendarPage'
import AdminAiUsagePage from './pages/AdminAiUsagePage'

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
          LOADING…
        </span>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/*" element={!session ? <AuthPage /> : (
        <AppLayout>
          <Routes>
            <Route path="/"         element={<DashboardPage />} />
            <Route path="/weekly"   element={<WeeklyPage />} />
            <Route path="/goals"    element={<GoalsPage />} />
            <Route path="/habits"   element={<HabitsPage />} />
            <Route path="/content"  element={<ContentPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/partners" element={<PartnersPage />} />
                <Route path="/partners/:partnerId/compare" element={<ComparePage />} />
            <Route path="/ai-log"   element={<AILogPage />} />
            <Route path="/finance"  element={<FinancePage />} />
            <Route path="/wellness" element={<WellnessPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/bucket-list" element={<BucketListPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin/ai-usage" element={<AdminAiUsagePage />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      )} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <TimerProvider>
            <AppRoutes />
          </TimerProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
