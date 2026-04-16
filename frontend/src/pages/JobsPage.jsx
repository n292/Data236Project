import { useEffect, useMemo, useState } from 'react'
import JobCard from '../components/JobCard.jsx'
import JobDetailPanel from '../components/JobDetailPanel.jsx'

const FILTER_PILLS = [
  'Date posted',
  'LinkedIn features',
  'Company',
  'Experience level',
  'All filters'
]

export default function JobsPage () {
  const [keyword, setKeyword] = useState('engineer')
  const [location, setLocation] = useState('San Francisco Bay Area')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [savedJobIds, setSavedJobIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const response = await fetch('/api/v1/jobs/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: 1,
            limit: 25,
            keyword: keyword.trim() || undefined,
            location: location.trim() || undefined
          })
        })
        if (!response.ok) {
          throw new Error(`search_failed_${response.status}`)
        }
        const data = await response.json()
        const rows = Array.isArray(data.jobs) ? data.jobs : []
        const mapped = rows.map((job) => {
          const rawDesc = job.description || 'No description provided yet.'
          const looksHtml = /<[a-z][\s\S]*>/i.test(rawDesc)
          return {
            job_id: job.job_id,
            title: job.title,
            company: job.company_id ? `Company ${String(job.company_id).slice(0, 8)}` : 'Unknown company',
            location: job.location || 'Unknown',
            postedAt: job.posted_datetime || new Date().toISOString(),
            viewsCount: Number(job.views_count || 0),
            easyApply: true,
            profileMatch: false,
            applicantsCount: Number(job.applicants_count || 0),
            description: looksHtml ? '' : rawDesc,
            descriptionHtml: looksHtml ? rawDesc : null,
            employmentType: job.employment_type || 'Full-time',
            remote: job.remote || 'onsite',
            skills: Array.isArray(job.skills_required) ? job.skills_required : []
          }
        })
        if (!cancelled) {
          setJobs(mapped)
          setSelectedJobId((prev) => {
            if (mapped.length === 0) return ''
            if (mapped.some((j) => j.job_id === prev)) return prev
            return mapped[0].job_id
          })
        }
      } catch (e) {
        if (!cancelled) {
          setJobs([])
          setSelectedJobId('')
          setError('Could not load jobs. Check that job-service is running on port 3003.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword, location])

  const selectedJob = useMemo(
    () => jobs.find((j) => j.job_id === selectedJobId) || jobs[0] || null,
    [jobs, selectedJobId]
  )

  function toggleSave (jobId) {
    setSavedJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  return (
    <main className="jobs-page">
      <header className="jobs-topbar">
        <div className="jobs-topbar__brand">in</div>
        <div className="jobs-topbar__search">Search jobs and companies</div>
      </header>

      <section className="jobs-search-row">
        <input
          className="jobs-search-row__input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Job keyword search"
        />
        <input
          className="jobs-search-row__input jobs-search-row__input--location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          aria-label="Job location search"
        />
      </section>

      <section className="jobs-filter-pills" aria-label="Search filters">
        {FILTER_PILLS.map((pill) => (
          <button key={pill} className="jobs-filter-pills__pill" type="button">
            {pill}
          </button>
        ))}
      </section>

      <section className="jobs-split-pane">
        <aside className="jobs-list">
          {loading && <div className="jobs-list__hint">Loading jobs...</div>}
          {error && <div className="jobs-list__hint jobs-list__hint--error">{error}</div>}
          {!loading && !error && jobs.length === 0 && (
            <div className="jobs-list__hint">No jobs found for current filters.</div>
          )}
          {jobs.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              selected={job.job_id === selectedJobId}
              saved={savedJobIds.has(job.job_id)}
              onSelect={setSelectedJobId}
              onToggleSave={toggleSave}
            />
          ))}
        </aside>

        <JobDetailPanel
          job={selectedJob}
          saved={selectedJob ? savedJobIds.has(selectedJob.job_id) : false}
          onToggleSave={toggleSave}
        />
      </section>
    </main>
  )
}
