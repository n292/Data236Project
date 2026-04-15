import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import JobsPage from './pages/JobsPage.jsx'
import JobDetailPage from './pages/JobDetailPage.jsx'
import RecruiterJobsPage from './pages/RecruiterJobsPage.jsx'
import RecruiterJobNewPage from './pages/RecruiterJobNewPage.jsx'
import RecruiterJobEditPage from './pages/RecruiterJobEditPage.jsx'

export default function App () {
  return (
    <div className="stub">
      <nav>
        <NavLink to="/jobs">/jobs</NavLink>
        <NavLink to="/jobs/123">/jobs/123</NavLink>
        <NavLink to="/recruiter/jobs">/recruiter/jobs</NavLink>
        <NavLink to="/recruiter/jobs/new">/recruiter/jobs/new</NavLink>
        <NavLink to="/recruiter/jobs/123/edit">/recruiter/jobs/123/edit</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/recruiter/jobs" element={<RecruiterJobsPage />} />
        <Route path="/recruiter/jobs/new" element={<RecruiterJobNewPage />} />
        <Route path="/recruiter/jobs/:id/edit" element={<RecruiterJobEditPage />} />
        <Route path="*" element={<JobsPage />} />
      </Routes>
    </div>
  )
}
