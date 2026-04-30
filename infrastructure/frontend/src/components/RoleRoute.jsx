import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ role, children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return <div style={{ textAlign: 'center', paddingTop: 80, color: '#56687A' }}>Loading…</div>
  }
  if (user === null) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (user.role !== role) {
    const fallback = user.role === 'recruiter' ? '/recruiter/dashboard' : '/feed'
    return <Navigate to={fallback} replace />
  }
  return children
}
