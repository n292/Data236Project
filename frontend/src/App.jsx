import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import JobsPage from './pages/JobsPage.jsx'
import JobDetailPage from './pages/JobDetailPage.jsx'
import RecruiterJobsPage from './pages/RecruiterJobsPage.jsx'
import RecruiterJobNewPage from './pages/RecruiterJobNewPage.jsx'
import RecruiterJobEditPage from './pages/RecruiterJobEditPage.jsx'

export default function App () {
  return (
    <div className="stub">
      <header className="app-navbar">
        <div className="app-navbar__inner">
          <NavLink to="/jobs" className="app-navbar__logo" aria-label="LinkedIn home">
            in
          </NavLink>
          <nav className="app-navbar__menu" aria-label="Primary">
            <NavLink to="/jobs">Jobs</NavLink>
            <NavLink to="/recruiter/jobs">Recruiter Jobs</NavLink>
            <NavLink to="/recruiter/jobs/new">Post a Job</NavLink>
          </nav>
        </div>
      </header>
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
