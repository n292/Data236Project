import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import { ToastProvider } from './components/common/Toast'

// Auth
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

// Profile
import CreateProfilePage from './pages/CreateProfilePage'
import SearchMembersPage from './pages/SearchMembersPage'
import MemberDetailPage from './pages/MemberDetailPage'
import EditProfilePage from './pages/EditProfilePage'

// Jobs (M2 / job-service)
import JobsPage from './pages/JobsPage.jsx'
import JobDetailPage from './pages/JobDetailPage.jsx'
import RecruiterJobsPage from './pages/RecruiterJobsPage.jsx'
import RecruiterJobNewPage from './pages/RecruiterJobNewPage.jsx'
import RecruiterJobEditPage from './pages/RecruiterJobEditPage.jsx'

// Applications (M3)
import ApplyPage from './pages/ApplyPage'
import RecruiterReviewPage from './pages/RecruiterReviewPage'
import MyApplicationsPage from './pages/MyApplicationsPage'
import SavedJobsPage from './pages/SavedJobsPage'

// Dashboards (M5/M6)
import MemberDashboardPage from './pages/MemberDashboardPage'
import RecruiterDashboardPage from './pages/RecruiterDashboardPage'

// Messaging & Connections (M4)
import MessagingPage from './pages/Messaging/MessagingPage'
import ConnectionsPage from './pages/Connections/ConnectionsPage'
import FeedPage from './pages/Home/HomePage'

// AI (M7)
import CareerCoachPage from './pages/CareerCoachPage'

function ProtectedApp() {
  const { user } = useAuth()
  const currentUserId = user?.member_id || ''
  const currentUserName = user ? `${user.first_name} ${user.last_name}`.trim() : ''
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />

        {/* Profile */}
        <Route path="/members/create" element={<CreateProfilePage />} />
        <Route path="/members/search" element={<SearchMembersPage />} />
        <Route path="/members/:memberId" element={<MemberDetailPage />} />
        <Route path="/members/:memberId/edit" element={<EditProfilePage />} />

        {/* Jobs — open browsing */}
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />

        {/* Jobs — member only */}
        <Route path="/jobs/saved" element={<RoleRoute role="member"><SavedJobsPage /></RoleRoute>} />

        {/* Jobs — recruiter only */}
        <Route path="/recruiter/jobs" element={<RoleRoute role="recruiter"><RecruiterJobsPage /></RoleRoute>} />
        <Route path="/recruiter/jobs/new" element={<RoleRoute role="recruiter"><RecruiterJobNewPage /></RoleRoute>} />
        <Route path="/recruiter/jobs/:id/edit" element={<RoleRoute role="recruiter"><RecruiterJobEditPage /></RoleRoute>} />

        {/* Applications — member only */}
        <Route path="/applications/apply" element={<RoleRoute role="member"><ApplyPage /></RoleRoute>} />
        <Route path="/apply/:jobId" element={<RoleRoute role="member"><ApplyPage /></RoleRoute>} />
        <Route path="/applications" element={<RoleRoute role="member"><MyApplicationsPage /></RoleRoute>} />

        {/* Applications — recruiter only */}
        <Route path="/applications/review" element={<RoleRoute role="recruiter"><RecruiterReviewPage /></RoleRoute>} />

        {/* Dashboards */}
        <Route path="/dashboard" element={<RoleRoute role="member"><MemberDashboardPage /></RoleRoute>} />
        <Route path="/recruiter/dashboard" element={<RoleRoute role="recruiter"><RecruiterDashboardPage /></RoleRoute>} />

        {/* Messaging & Connections */}
        <Route path="/messaging" element={<MessagingPage currentUserId={currentUserId} currentUserName={currentUserName} />} />
        <Route path="/connections" element={<ConnectionsPage currentUserId={currentUserId} />} />
        <Route path="/feed" element={<FeedPage currentUserId={currentUserId} currentUserName={currentUserName} currentUserPhoto={user?.profile_photo_url || null} />} />

        {/* AI — Career Coach (member only) */}
        <Route path="/career-coach" element={<RoleRoute role="member"><CareerCoachPage /></RoleRoute>} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public auth routes — no Layout wrapper */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Everything else requires login */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
