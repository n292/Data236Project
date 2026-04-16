import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const DEFAULT_RECRUITER_ID = '00000000-0000-4000-8000-000000001002'

export default function RecruiterJobsPage () {
  const [recruiterId, setRecruiterId] = useState(DEFAULT_RECRUITER_ID)
  const [statusFilter, setStatusFilter] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmJob, setConfirmJob] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const response = await fetch('/api/v1/jobs/byRecruiter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recruiter_id: recruiterId.trim(),
            status: statusFilter || undefined,
            page: 1,
            limit: 100
          })
        })
        if (!response.ok) throw new Error(`load_failed_${response.status}`)
        const body = await response.json()
        if (!cancelled) setJobs(Array.isArray(body.jobs) ? body.jobs : [])
      } catch (e) {
        if (!cancelled) {
          setJobs([])
          setError('Could not load recruiter jobs.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [recruiterId, statusFilter])

  async function closeJob (job) {
    try {
      setActionBusy(true)
      const response = await fetch('/api/v1/jobs/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.job_id,
          recruiter_id: recruiterId.trim()
        })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'close_failed')
      }
      setJobs((prev) => prev.map((j) => (j.job_id === job.job_id ? { ...j, status: 'closed' } : j)))
      setConfirmJob(null)
    } catch (e) {
      setError(`Close failed: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <main className="recruiter-jobs-page">
      <header className="recruiter-jobs-page__header">
        <h1>Recruiter Job Management</h1>
        <p>Track open/closed jobs, views, and applicants. Close postings with confirmation.</p>
      </header>

      <section className="recruiter-jobs-toolbar">
        <label>
          Recruiter ID
          <input
            value={recruiterId}
            onChange={(e) => setRecruiterId(e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </section>

      {error && <div className="recruiter-jobs-alert recruiter-jobs-alert--error">{error}</div>}

      <section className="recruiter-jobs-table-wrap">
        {loading && <div className="recruiter-jobs-alert">Loading jobs...</div>}
        {!loading && jobs.length === 0 && (
          <div className="recruiter-jobs-alert">No jobs found for this recruiter and filter.</div>
        )}
        {jobs.length > 0 && (
          <table className="recruiter-jobs-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Views</th>
                <th>Applicants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>
                    <div className="recruiter-jobs-table__title">{job.title}</div>
                    <div className="recruiter-jobs-table__sub">{job.location}</div>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{job.views_count}</td>
                  <td>{job.applicants_count}</td>
                  <td className="recruiter-jobs-table__actions">
                    <Link to={`/recruiter/jobs/${job.job_id}/edit`}>Edit</Link>
                    <button
                      type="button"
                      disabled={job.status === 'closed'}
                      onClick={() => setConfirmJob(job)}
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirmJob && (
        <div className="recruiter-modal__backdrop" role="presentation">
          <div className="recruiter-modal" role="dialog" aria-modal="true" aria-label="Confirm close job">
            <h3>Close job posting?</h3>
            <p>
              You are closing <strong>{confirmJob.title}</strong>. This cannot be applied to after closing.
            </p>
            <div className="recruiter-modal__actions">
              <button type="button" onClick={() => setConfirmJob(null)} disabled={actionBusy}>
                Cancel
              </button>
              <button type="button" onClick={() => closeJob(confirmJob)} disabled={actionBusy}>
                {actionBusy ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
