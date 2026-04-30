import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApplicationsByMember } from '../api/applicationApi'

const STATUS_COLORS = {
  submitted: { bg: '#EEF3F8', color: '#0A66C2' },
  reviewed:  { bg: '#FDF6EC', color: '#915907' },
  accepted:  { bg: '#EDF9F1', color: '#057642' },
  rejected:  { bg: '#FFF4F4', color: '#8A1C1C' },
}

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || { bg: '#F3F2EF', color: '#56687A' }
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

export default function MyApplicationsPage() {
  const memberId = localStorage.getItem('viewer_id') || ''
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!memberId) { setLoading(false); return }
    getApplicationsByMember(memberId)
      .then(data => setApps(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [memberId])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>My Applications</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#56687A' }}>Track the status of your job applications</p>
      </div>

      {error && <div className="alert error-alert">{error}</div>}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#56687A' }}>Loading…</div>}

      {!loading && !memberId && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 40, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No member selected</div>
          <div style={{ fontSize: 14 }}>View a profile first to track applications</div>
        </div>
      )}

      {!loading && memberId && apps.length === 0 && !error && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 40, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No applications yet</div>
          <div style={{ fontSize: 14 }}>
            <Link to="/jobs" style={{ color: '#0A66C2' }}>Browse jobs</Link> to start applying
          </div>
        </div>
      )}

      {apps.map(app => (
        <div key={app.application_id} style={{
          background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
          padding: '16px 24px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Job #{app.job_id?.slice(0, 8) || 'N/A'}</span>
              <StatusBadge status={app.status} />
            </div>
            <div style={{ fontSize: 13, color: '#56687A' }}>
              Applied {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
              {app.resume_file_name && <span style={{ marginLeft: 12 }}>Resume: {app.resume_file_name}</span>}
            </div>
            {app.recruiter_note && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#38434F', background: '#F3F2EF', padding: '6px 10px', borderRadius: 4 }}>
                <strong>Recruiter note:</strong> {app.recruiter_note}
              </div>
            )}
          </div>
          <Link to={`/jobs/${app.job_id}`} style={{ fontSize: 13, color: '#0A66C2', whiteSpace: 'nowrap' }}>
            View job
          </Link>
        </div>
      ))}
    </div>
  )
}
