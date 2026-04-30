import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RecruiterJobsPage () {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmJob, setConfirmJob] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  const recruiterId = user?.member_id

  useEffect(() => {
    if (!recruiterId) return
    let cancelled = false
    setLoading(true)
    setError('')

    const token = localStorage.getItem('token')
    fetch('/api/v1/jobs/byRecruiter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ recruiter_id: recruiterId, status: statusFilter || undefined, page: 1, limit: 100 }),
    })
      .then(r => r.json())
      .then(body => { if (!cancelled) setJobs(Array.isArray(body.jobs) ? body.jobs : []) })
      .catch(() => { if (!cancelled) setError('Could not load your job postings.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [recruiterId, statusFilter])

  async function closeJob (job) {
    const token = localStorage.getItem('token')
    try {
      setActionBusy(true)
      const res = await fetch('/api/v1/jobs/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ job_id: job.job_id, recruiter_id: recruiterId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Close failed')
      setJobs(prev => prev.map(j => j.job_id === job.job_id ? { ...j, status: 'closed' } : j))
      setConfirmJob(null)
    } catch (e) {
      setError(`Close failed: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>My Job Postings</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#56687A' }}>
            {user ? <>Posting as <strong>{user.first_name} {user.last_name}</strong></> : 'Loading…'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ border: '1px solid #CACCCE', borderRadius: 4, padding: '7px 12px', fontSize: 14, background: '#fff' }}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <Link to="/recruiter/jobs/new"
            style={{ background: '#0A66C2', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            + Post a Job
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#56687A', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8 }}>
          Loading your jobs…
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 48, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'rgba(0,0,0,0.7)', marginBottom: 8 }}>No job postings yet</div>
          <Link to="/recruiter/jobs/new"
            style={{ display: 'inline-block', marginTop: 8, background: '#0A66C2', color: '#fff', padding: '10px 24px', borderRadius: 999, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            Post your first job
          </Link>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F2EF', background: '#F9F9F9' }}>
                {['Job', 'Company', 'Location', 'Status', 'Views', 'Applicants', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#56687A', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.job_id} style={{ borderBottom: '1px solid #F3F2EF' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'rgba(0,0,0,0.9)' }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: '#86888A', marginTop: 2, fontFamily: 'monospace' }}>{job.job_id}</div>
                    <div style={{ fontSize: 12, color: '#56687A', marginTop: 1 }}>{job.employment_type?.replace('_', ' ')}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
                    {job.company_name || `ID: ${String(job.company_id || '').slice(0, 8)}`}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>{job.location}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
                      background: job.status === 'open' ? '#e8f7ec' : '#F3F2EF',
                      color: job.status === 'open' ? '#057642' : '#56687A',
                    }}>
                      {job.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#56687A', textAlign: 'center' }}>{job.views_count}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#56687A', textAlign: 'center' }}>{job.applicants_count}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/recruiter/jobs/${job.job_id}/edit`}
                        style={{ fontSize: 13, color: '#0A66C2', fontWeight: 600, textDecoration: 'none' }}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={job.status === 'closed'}
                        onClick={() => setConfirmJob(job)}
                        style={{ fontSize: 13, color: job.status === 'closed' ? '#CACCCE' : '#C0392B', fontWeight: 600, background: 'none', border: 'none', cursor: job.status === 'closed' ? 'default' : 'pointer', padding: 0 }}
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm close modal */}
      {confirmJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '24px 28px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>Close job posting?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#56687A' }}>
              <strong>{confirmJob.title}</strong> will no longer accept new applications.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmJob(null)} disabled={actionBusy}
                style={{ padding: '8px 20px', borderRadius: 999, border: '1px solid #CACCCE', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => closeJob(confirmJob)} disabled={actionBusy}
                style={{ padding: '8px 20px', borderRadius: 999, border: 'none', background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 600, cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.7 : 1 }}>
                {actionBusy ? 'Closing…' : 'Close Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
