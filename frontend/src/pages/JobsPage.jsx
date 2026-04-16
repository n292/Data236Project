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

const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const EXPERIENCE_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']
const REMOTE_OPTIONS = ['onsite', 'remote', 'hybrid']
const DEFAULT_MEMBER_ID = '00000000-0000-4000-8000-000000009999'
const TRACE_ID_KEY = 'job_ui_trace_id'

function createUuidV4 () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function getSessionTraceId () {
  const existing = sessionStorage.getItem(TRACE_ID_KEY)
  if (existing) return existing
  const next = createUuidV4()
  sessionStorage.setItem(TRACE_ID_KEY, next)
  return next
}

function toggleInList (list, value) {
  if (list.includes(value)) return list.filter((item) => item !== value)
  return [...list, value]
}

export default function JobsPage () {
  const [keyword, setKeyword] = useState('engineer')
  const [location, setLocation] = useState('')
  const [employmentTypes, setEmploymentTypes] = useState([])
  const [experienceLevels, setExperienceLevels] = useState([])
  const [remoteModes, setRemoteModes] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [savedJobIds, setSavedJobIds] = useState(new Set())
  const [viewedJobIds, setViewedJobIds] = useState(new Set())
  const [eventNotice, setEventNotice] = useState('')

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
            location: location.trim() || undefined,
            employment_type: employmentTypes.length ? employmentTypes : undefined,
            seniority_level: experienceLevels.length ? experienceLevels : undefined,
            remote: remoteModes.length ? remoteModes : undefined
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
            seniorityLevel: job.seniority_level || null,
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
  }, [keyword, location, employmentTypes, experienceLevels, remoteModes])

  const selectedJob = useMemo(
    () => jobs.find((j) => j.job_id === selectedJobId) || jobs[0] || null,
    [jobs, selectedJobId]
  )

  useEffect(() => {
    let active = true
    async function emitViewed () {
      if (!selectedJobId) return
      if (viewedJobIds.has(selectedJobId)) return
      try {
        const traceId = getSessionTraceId()
        const response = await fetch('/api/v1/jobs/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: selectedJobId,
            viewer_id: DEFAULT_MEMBER_ID,
            trace_id: traceId
          })
        })
        if (!response.ok) throw new Error(`viewed_emit_failed_${response.status}`)
        if (!active) return
        setViewedJobIds((prev) => {
          const next = new Set(prev)
          next.add(selectedJobId)
          return next
        })
      } catch {
        if (active) setEventNotice('Could not emit job.viewed event right now.')
      }
    }
    void emitViewed()
    return () => {
      active = false
    }
  }, [selectedJobId, viewedJobIds])

  async function toggleSave (jobId) {
    const currentlySaved = savedJobIds.has(jobId)
    if (currentlySaved) {
      setSavedJobIds((prev) => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      return
    }

    try {
      const traceId = getSessionTraceId()
      const response = await fetch('/api/v1/jobs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          user_id: DEFAULT_MEMBER_ID,
          trace_id: traceId
        })
      })
      if (!response.ok) throw new Error(`save_emit_failed_${response.status}`)

      setSavedJobIds((prev) => {
        const next = new Set(prev)
        next.add(jobId)
        return next
      })
      setEventNotice('Saved event emitted.')
      setTimeout(() => setEventNotice(''), 1500)
    } catch {
      setEventNotice('Could not emit job.saved event right now.')
    }
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
          placeholder="City, state, or region"
        />
      </section>

      <section className="jobs-filter-pills" aria-label="Search filters">
        {FILTER_PILLS.map((pill) => (
          <button key={pill} className="jobs-filter-pills__pill" type="button">
            {pill}
          </button>
        ))}
      </section>

      {eventNotice && <div className="jobs-event-notice">{eventNotice}</div>}

      <section className="jobs-layout">
        <aside className="jobs-filters-sidebar" aria-label="Advanced search filters">
          <h3>Filters</h3>

          <div className="jobs-filter-group">
            <h4>Employment Type</h4>
            {EMPLOYMENT_OPTIONS.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={employmentTypes.includes(value)}
                  onChange={() => setEmploymentTypes((prev) => toggleInList(prev, value))}
                />
                <span>{value.replace('_', '-')}</span>
              </label>
            ))}
          </div>

          <div className="jobs-filter-group">
            <h4>Experience Level</h4>
            {EXPERIENCE_OPTIONS.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={experienceLevels.includes(value)}
                  onChange={() => setExperienceLevels((prev) => toggleInList(prev, value))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <div className="jobs-filter-group">
            <h4>Remote</h4>
            {REMOTE_OPTIONS.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={remoteModes.includes(value)}
                  onChange={() => setRemoteModes((prev) => toggleInList(prev, value))}
                />
                <span>{value === 'onsite' ? 'On-site' : value.charAt(0).toUpperCase() + value.slice(1)}</span>
              </label>
            ))}
          </div>
        </aside>

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
      </section>
    </main>
  )
}
