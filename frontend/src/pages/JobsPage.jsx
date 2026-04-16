import { useEffect, useMemo, useState } from 'react'
import JobCard from '../components/JobCard.jsx'
import JobDetailPanel from '../components/JobDetailPanel.jsx'

const FILTER_PILLS = ['Date posted', 'LinkedIn features', 'Company', 'Experience level', 'All filters']
const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const EXPERIENCE_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']
const REMOTE_OPTIONS = ['onsite', 'remote', 'hybrid']
const DEFAULT_MEMBER_ID = '00000000-0000-4000-8000-000000009999'
const TRACE_ID_KEY = 'job_ui_trace_id'

function createUuidV4 () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
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

async function postJson (url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export default function JobsPage () {
  const [keyword, setKeyword] = useState('')
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
  const [applyingJobId, setApplyingJobId] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const { ok, status, body } = await postJson('/api/v1/jobs/search', {
          page: 1,
          limit: 25,
          keyword: keyword.trim() || undefined,
          location: location.trim() || undefined,
          employment_type: employmentTypes.length ? employmentTypes : undefined,
          seniority_level: experienceLevels.length ? experienceLevels : undefined,
          remote: remoteModes.length ? remoteModes : undefined
        })
        if (!ok) throw new Error(`search_failed_${status}`)
        const rows = Array.isArray(body.jobs) ? body.jobs : []
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
      } catch {
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
    async function emitViewedAndTrack () {
      if (!selectedJobId || viewedJobIds.has(selectedJobId)) return

      const traceId = getSessionTraceId()
      const eventEnvelope = {
        event_type: 'job.viewed',
        trace_id: traceId,
        actor_id: DEFAULT_MEMBER_ID,
        entity: { entity_type: 'job', entity_id: selectedJobId },
        payload: { job_id: selectedJobId, viewer_id: DEFAULT_MEMBER_ID }
      }

      const ingest = await postJson('/events/ingest', eventEnvelope)
      if (!ingest.ok) {
        // keep silent for now; this endpoint is owned by analytics service and may be unavailable locally
      }

      const viewed = await postJson('/api/v1/jobs/view', {
        job_id: selectedJobId,
        viewer_id: DEFAULT_MEMBER_ID,
        trace_id: traceId
      })
      if (!viewed.ok && active) {
        setEventNotice('Could not emit job.viewed event right now.')
      }
      if (!active) return
      setViewedJobIds((prev) => new Set(prev).add(selectedJobId))
    }
    void emitViewedAndTrack()
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

    const traceId = getSessionTraceId()
    const eventEnvelope = {
      event_type: 'job.saved',
      trace_id: traceId,
      actor_id: DEFAULT_MEMBER_ID,
      entity: { entity_type: 'job', entity_id: jobId },
      payload: { job_id: jobId, user_id: DEFAULT_MEMBER_ID }
    }
    const ingest = await postJson('/events/ingest', eventEnvelope)
    const persisted = await postJson('/api/v1/jobs/save', {
      job_id: jobId,
      user_id: DEFAULT_MEMBER_ID,
      trace_id: traceId
    })

    if (!ingest.ok && !persisted.ok) {
      setEventNotice('Could not emit job.saved event right now.')
      return
    }
    setSavedJobIds((prev) => new Set(prev).add(jobId))
    setEventNotice('Saved event emitted.')
    setTimeout(() => setEventNotice(''), 1200)
  }

  async function applyToJob (job) {
    if (!job) return
    setApplyingJobId(job.job_id)
    setEventNotice('')
    const traceId = getSessionTraceId()
    const payload = {
      job_id: job.job_id,
      member_id: DEFAULT_MEMBER_ID,
      trace_id: traceId
    }

    // Required by UI spec; support legacy /api/v1 path fallback.
    let result = await postJson('/applications/create', payload)
    if (!result.ok) {
      result = await postJson('/api/v1/applications/create', payload)
    }
    if (result.ok) {
      setEventNotice('Application submitted.')
    } else {
      setEventNotice('Apply endpoint unavailable right now.')
    }
    setApplyingJobId('')
  }

  return (
    <main className="jobs-page">
      <section className="jobs-search-row jobs-search-row--top">
        <input
          className="jobs-search-row__input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search jobs, skills, companies"
          aria-label="Search jobs, skills, companies"
        />
        <input
          className="jobs-search-row__input jobs-search-row__input--location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, state, region"
          aria-label="City, state, region"
        />
      </section>

      <section className="jobs-filter-pills" aria-label="Search filters">
        {FILTER_PILLS.map((pill) => (
          <button key={pill} className="jobs-filter-pills__pill" type="button">{pill}</button>
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
            {loading && jobs.length === 0 && (
              <>
                <div className="job-card-skeleton" />
                <div className="job-card-skeleton" />
                <div className="job-card-skeleton" />
              </>
            )}
            {!loading && error && <div className="jobs-list__hint jobs-list__hint--error">{error}</div>}
            {!loading && !error && jobs.length === 0 && (
              <div className="jobs-list__hint jobs-list__hint--empty">
                <h3>No jobs found</h3>
                <p>Try broader keywords or clear one of your selected filters.</p>
              </div>
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
            onApply={applyToJob}
            applying={selectedJob ? applyingJobId === selectedJob.job_id : false}
          />
        </section>
      </section>
    </main>
  )
}
