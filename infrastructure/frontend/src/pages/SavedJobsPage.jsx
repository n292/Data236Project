import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSavedJobs } from '../api/jobApi'
import { useAuth } from '../context/AuthContext'

export default function SavedJobsPage() {
  const { user } = useAuth()
  const userId = user?.member_id || ''
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    getSavedJobs(userId)
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Saved Jobs</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#56687A' }}>Jobs you have saved for later</p>
      </div>

      {error && <div className="alert error-alert">{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#56687A' }}>Loading…</div>}

      {!loading && !userId && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 40, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
          <div style={{ fontWeight: 600 }}>No member selected</div>
        </div>
      )}

      {!loading && userId && jobs.length === 0 && !error && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 40, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No saved jobs</div>
          <div style={{ fontSize: 14 }}>
            <Link to="/jobs" style={{ color: '#0A66C2' }}>Browse jobs</Link> and save ones you like
          </div>
        </div>
      )}

      {jobs.map(job => (
        <div key={job.job_id} style={{
          background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
          padding: '16px 24px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Link to={`/jobs/${job.job_id}`} style={{ fontWeight: 600, fontSize: 16, color: '#0A66C2', textDecoration: 'none' }}>
                {job.title}
              </Link>
              <p style={{ margin: '2px 0', fontSize: 14, color: '#38434F' }}>{job.location}</p>
              <p style={{ margin: '2px 0', fontSize: 13, color: '#56687A' }}>
                {job.employment_type}{job.remote && job.remote !== 'onsite' ? ` · ${job.remote}` : ''}
              </p>
              {job.skills_required?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {job.skills_required.slice(0, 4).map(s => (
                    <span key={s} style={{ background: '#EEF3F8', color: '#0A66C2', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{
                background: job.status === 'open' ? '#EDF9F1' : '#F3F2EF',
                color: job.status === 'open' ? '#057642' : '#56687A',
                padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              }}>
                {job.status}
              </span>
              <Link to={`/jobs?apply=true&jobId=${job.job_id}`} style={{
                background: '#0A66C2', color: '#fff', border: 'none',
                borderRadius: 999, padding: '6px 16px', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', cursor: 'pointer',
              }}>
                Easy Apply
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
