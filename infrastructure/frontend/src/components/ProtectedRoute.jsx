import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return <div style={{ textAlign: 'center', paddingTop: 80, color: '#56687A' }}>Loading…</div>
  }
  if (user === null) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}
