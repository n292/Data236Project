import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import JobCard from '../components/JobCard.jsx'
import JobDetailPanel from '../components/JobDetailPanel.jsx'
import { useAuth } from '../context/AuthContext'
import { submitApplication } from '../api/applicationApi'
import EasyApplyModal from '../components/EasyApplyModal'

const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const EXPERIENCE_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']
const REMOTE_OPTIONS     = ['onsite', 'remote', 'hybrid']
const INDUSTRY_OPTIONS   = ['Technology','Finance','Healthcare','Education','Retail','Manufacturing','Consulting','Media','Transportation','Energy']

const FILTER_PILLS_CONFIG = [
  { id: 'date',     label: 'Date posted' },
  { id: 'features', label: 'Easy Apply' },
  { id: 'company',  label: 'Company' },
  { id: 'level',    label: 'Experience level' },
  { id: 'all',      label: 'All filters' },
]

const DATE_OPTIONS = [
  { value: '',   label: 'Any time' },
  { value: '1',  label: 'Past 24 hours' },
  { value: '7',  label: 'Past week' },
  { value: '30', label: 'Past month' },
]

const DEFAULT_MEMBER_ID = '00000000-0000-4000-8000-000000009999'
const TRACE_ID_KEY = 'job_ui_trace_id'
const PAGE_SIZE = 15

function createUuidV4 () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
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
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
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
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [keyword, setKeyword]               = useState('')
  const [locationInput, setLocationInput]     = useState('')
  const [employmentTypes, setEmploymentTypes] = useState([])
  const [experienceLevels, setExperienceLevels] = useState([])
  const [remoteModes, setRemoteModes]       = useState([])
  const [industries, setIndustries]         = useState([])
  const [dateFilter, setDateFilter]         = useState('')
  const [companyFilter, setCompanyFilter]   = useState('')
  const [companyInput, setCompanyInput]     = useState('')
  const [easyApplyOnly, setEasyApplyOnly]   = useState(false)
  const [activePill, setActivePill]         = useState(null)

  const [jobs, setJobs]                     = useState([])
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [page, setPage]                     = useState(1)
  const [hasMore, setHasMore]               = useState(false)
  const [sortBy, setSortBy]                 = useState('relevance')
  const [splitView, setSplitView]           = useState(true)
  const [jobAlertsEnabled, setJobAlertsEnabled] = useState(false)
  const [selectedJobId, setSelectedJobId]   = useState('')
  const [savedJobIds, setSavedJobIds]       = useState(new Set())
  const [viewedJobIds, setViewedJobIds]     = useState(new Set())
  const [eventNotice, setEventNotice]       = useState('')
  const [applyingJobId, setApplyingJobId]   = useState('')
  const [debouncedSearchKey, setDebouncedSearchKey] = useState('')
  const [refreshTick, setRefreshTick]           = useState(0)
  const [showApplyModal, setShowApplyModal]     = useState(false)
  const [targetJob, setTargetJob]               = useState(null)

  const pillsRef = useRef(null)

  useEffect(() => {
    const memberId = user?.member_id
    if (!memberId) return

    // ── Handle incoming ?apply=true&jobId=... from other pages ──
    const applyParam = searchParams.get('apply')
    const jobIdParam = searchParams.get('jobId')

    if (applyParam === 'true' && jobIdParam) {
      // Find the job in the current list or wait for it to load
      const job = jobs.find(j => j.job_id === jobIdParam)
      if (job) {
        setTargetJob(job)
        setSelectedJobId(jobIdParam)
        setShowApplyModal(true)
        // Clear params to avoid re-opening on refresh
        navigate('/jobs', { replace: true })
      }
    }
  }, [user, searchParams, jobs, navigate])

  // ── Load saved job IDs ──
  useEffect(() => {
    const memberId = user?.member_id
    if (!memberId) return
    const token = localStorage.getItem('token')
    fetch('/api/v1/jobs/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ user_id: memberId }),
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.jobs)) {
          setSavedJobIds(new Set(d.jobs.map(j => j.job_id)))
        }
      })
      .catch(() => {})
  }, [user?.member_id])

  // ── Close pill popover on outside click ──
  useEffect(() => {
    if (!activePill) return
    function handleOutside (e) {
      if (pillsRef.current && !pillsRef.current.contains(e.target)) setActivePill(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [activePill])

  // ── Debounce search inputs ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKey(JSON.stringify({
        keyword, locationInput, employmentTypes, experienceLevels, remoteModes, industries, dateFilter, companyFilter
      }))
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword, locationInput, employmentTypes, experienceLevels, remoteModes, industries, dateFilter, companyFilter])

  // ── Auto-refresh every 30s so newly posted jobs appear ──
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setPage(1) }, [debouncedSearchKey])

  // ── Fetch jobs ──
  useEffect(() => {
    let cancelled = false
    const parsed = debouncedSearchKey
      ? JSON.parse(debouncedSearchKey)
      : { keyword: '', locationInput: '', employmentTypes: [], experienceLevels: [], remoteModes: [], industries: [], dateFilter: '', companyFilter: '' }

    async function fetchJobs () {
      try {
        setLoading(true)
        setError('')
        const { ok, status, body } = await postJson('/api/v1/jobs/search', {
          page,
          limit: PAGE_SIZE,
          keyword:         parsed.keyword.trim() || undefined,
          location:        parsed.locationInput.trim() || undefined,
          company:         parsed.companyFilter?.trim() || undefined,
          employment_type: parsed.employmentTypes.length ? parsed.employmentTypes : undefined,
          seniority_level: parsed.experienceLevels.length ? parsed.experienceLevels : undefined,
          remote:          parsed.remoteModes.length ? parsed.remoteModes : undefined,
          industry:        parsed.industries?.length ? parsed.industries : undefined,
          days_since:      parsed.dateFilter ? Number(parsed.dateFilter) : undefined,
        })
        if (!ok) throw new Error(`search_failed_${status}`)
        const rows = Array.isArray(body.jobs) ? body.jobs : []
        const mapped = rows.map((job) => {
          const rawDesc = job.description || 'No description provided yet.'
          const looksHtml = /<[a-z][\s\S]*>/i.test(rawDesc)
          return {
            job_id:         job.job_id,
            title:          job.title,
            company:        job.company_name || (job.company_id ? `Company ${String(job.company_id).slice(0, 8)}` : 'Unknown company'),
            location:       job.location || 'Unknown',
            postedAt:       job.posted_datetime || new Date().toISOString(),
            viewsCount:     Number(job.views_count || 0),
            easyApply:      true,
            profileMatch:   false,
            applicantsCount: Number(job.applicants_count || 0),
            description:    looksHtml ? '' : rawDesc,
            descriptionHtml: looksHtml ? rawDesc : null,
            employmentType: job.employment_type || 'Full-time',
            seniorityLevel: job.seniority_level || null,
            remote:         job.remote || 'onsite',
            skills:         Array.isArray(job.skills_required) ? job.skills_required : [],
            industry:       job.industry || null,
          }
        })
        if (!cancelled) {
          let merged = []
          setJobs((prev) => {
            merged = page === 1 ? mapped : [...prev, ...mapped]
            return merged
          })
          setHasMore(mapped.length === PAGE_SIZE)
          setSelectedJobId((prev) => {
            if (merged.length === 0) return ''
            if (merged.some((j) => j.job_id === prev)) return prev
            return merged[0].job_id
          })
        }
      } catch {
        if (!cancelled) {
          if (page === 1) { setJobs([]); setSelectedJobId('') }
          setError('Could not load jobs. Check that job-service is running on port 3002.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchJobs()
    return () => { cancelled = true }
  }, [debouncedSearchKey, page, refreshTick])

  // ── Client-side sort (company filter is now server-side) ──
  const sortedJobs = useMemo(() => {
    let list = [...jobs]
    if (sortBy === 'recent') list.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
    else if (sortBy === 'views') list.sort((a, b) => b.viewsCount - a.viewsCount)
    return list
  }, [jobs, sortBy])

  const selectedJob = useMemo(
    () => sortedJobs.find((j) => j.job_id === selectedJobId) || sortedJobs[0] || null,
    [sortedJobs, selectedJobId]
  )

  // ── Pill helpers ──
  const getAllFilterCount = useCallback(() => [
    dateFilter !== '',
    easyApplyOnly,
    companyFilter !== '',
    experienceLevels.length > 0,
    remoteModes.length > 0,
    employmentTypes.length > 0,
    industries.length > 0,
  ].filter(Boolean).length, [dateFilter, easyApplyOnly, companyFilter, experienceLevels, remoteModes, employmentTypes, industries])

  const isPillActive = useCallback((id) => {
    if (id === 'date')     return dateFilter !== ''
    if (id === 'features') return easyApplyOnly
    if (id === 'company')  return companyFilter !== ''
    if (id === 'level')    return experienceLevels.length > 0
    if (id === 'all')      return getAllFilterCount() > 0
    return false
  }, [dateFilter, easyApplyOnly, companyFilter, experienceLevels, getAllFilterCount])

  function clearAllFilters () {
    setDateFilter(''); setCompanyFilter(''); setCompanyInput(''); setEasyApplyOnly(false)
    setExperienceLevels([]); setEmploymentTypes([]); setRemoteModes([]); setIndustries([])
    setActivePill(null)
  }

  // ── Pill popover content ──
  function renderPillPopover (id) {
    if (id === 'date') return (
      <div className="pill-popover">
        <div className="pill-popover__header">Date posted</div>
        {DATE_OPTIONS.map((opt) => (
          <label key={opt.value} className="pill-popover__option">
            <input type="radio" name="date_filter"
              checked={dateFilter === opt.value}
              onChange={() => { setDateFilter(opt.value); setActivePill(null) }}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    )

    if (id === 'features') return (
      <div className="pill-popover">
        <div className="pill-popover__header">LinkedIn features</div>
        <label className="pill-popover__option">
          <input type="checkbox" checked={easyApplyOnly}
            onChange={() => { setEasyApplyOnly((v) => !v); setActivePill(null) }}
          />
          <span>Easy Apply</span>
        </label>
      </div>
    )

    if (id === 'company') return (
      <div className="pill-popover">
        <div className="pill-popover__header">Company</div>
        <div className="pill-popover__input-row">
          <input
            type="text"
            placeholder="e.g. Google, Amazon…"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setCompanyFilter(companyInput); setActivePill(null) } }}
            autoFocus
          />
          <button onClick={() => { setCompanyFilter(companyInput); setActivePill(null) }}>Apply</button>
        </div>
        {companyFilter && (
          <button className="pill-popover__clear"
            onClick={() => { setCompanyFilter(''); setCompanyInput(''); setActivePill(null) }}>
            Clear filter
          </button>
        )}
      </div>
    )

    if (id === 'level') return (
      <div className="pill-popover">
        <div className="pill-popover__header">Experience level</div>
        {EXPERIENCE_OPTIONS.map((value) => (
          <label key={value} className="pill-popover__option">
            <input type="checkbox"
              checked={experienceLevels.includes(value)}
              onChange={() => setExperienceLevels((prev) => toggleInList(prev, value))}
            />
            <span>{value}</span>
          </label>
        ))}
        {experienceLevels.length > 0 && (
          <button className="pill-popover__clear" onClick={() => { setExperienceLevels([]); setActivePill(null) }}>
            Clear
          </button>
        )}
      </div>
    )

    return null
  }

  // ── Job interaction handlers ──
  useEffect(() => {
    let active = true
    async function emitViewedAndTrack () {
      if (!selectedJobId || viewedJobIds.has(selectedJobId)) return
      const traceId = getSessionTraceId()
      const envelope = {
        event_type: 'job.viewed', trace_id: traceId, actor_id: DEFAULT_MEMBER_ID,
        entity: { entity_type: 'job', entity_id: selectedJobId },
        payload: { job_id: selectedJobId, viewer_id: DEFAULT_MEMBER_ID }
      }
      await postJson('/events/ingest', envelope)
      const viewed = await postJson('/api/v1/jobs/view', { job_id: selectedJobId, viewer_id: DEFAULT_MEMBER_ID, trace_id: traceId })
      if (!viewed.ok && active) setEventNotice('Could not emit job.viewed event right now.')
      if (!active) return
      setViewedJobIds((prev) => new Set(prev).add(selectedJobId))
    }
    void emitViewedAndTrack()
    return () => { active = false }
  }, [selectedJobId, viewedJobIds])

  async function toggleSave (jobId) {
    const memberId = user?.member_id
    if (!memberId) { setEventNotice('Sign in to save jobs.'); return }
    const token = localStorage.getItem('token')
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

    if (savedJobIds.has(jobId)) {
      setSavedJobIds((prev) => { const n = new Set(prev); n.delete(jobId); return n })
      await fetch('/api/v1/jobs/unsave', {
        method: 'POST', headers,
        body: JSON.stringify({ job_id: jobId, user_id: memberId }),
      }).catch(() => {})
      return
    }

    const traceId = getSessionTraceId()
    const res = await fetch('/api/v1/jobs/save', {
      method: 'POST', headers,
      body: JSON.stringify({ job_id: jobId, user_id: memberId, trace_id: traceId }),
    })
    if (!res.ok) { setEventNotice('Could not save job right now.'); return }
    setSavedJobIds((prev) => new Set(prev).add(jobId))
    setEventNotice('Job saved.')
    setTimeout(() => setEventNotice(''), 2000)
  }

  async function applyToJob (job) {
    if (!job) return
    const memberId = user?.member_id
    if (!memberId) { setEventNotice('Sign in to apply.'); return }
    setTargetJob(job)
    setShowApplyModal(true)
  }

  async function handleModalSubmit(payload) {
    setApplyingJobId(payload.job_id)
    setEventNotice('')
    try {
      await submitApplication(payload)
      setEventNotice('Application submitted!')
      setShowApplyModal(false)
      setTimeout(() => setEventNotice(''), 3000)
    } catch (e) {
      setEventNotice(e.message || 'Apply failed — please try again.')
    } finally {
      setApplyingJobId('')
    }
  }

  async function handleModalSave(payload) {
    try {
      await submitApplication(payload)
      setEventNotice('Draft saved.')
      setTimeout(() => setEventNotice(''), 3000)
    } catch (e) {
      console.error('Save draft failed:', e)
    }
  }

  const filterCount = getAllFilterCount()

  return (
    <main className="jobs-page">
      {/* ── Search row ── */}
      <section className="jobs-search-row jobs-search-row--top">
        <input
          className="jobs-search-row__input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Title, skill, or keyword"
          aria-label="Search jobs"
        />
        <input
          className="jobs-search-row__input jobs-search-row__input--location"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          placeholder="City, state, or remote"
          aria-label="Location"
        />
      </section>

      {/* ── Filter pills ── */}
      <section className="jobs-filter-pills" aria-label="Search filters" ref={pillsRef}>
        {FILTER_PILLS_CONFIG.map((pill) => {
          const isActive = isPillActive(pill.id)
          const isOpen   = activePill === pill.id
          const isAll    = pill.id === 'all'
          const pillLabel = isAll
            ? (filterCount > 0 ? `Clear all (${filterCount})` : 'All filters')
            : pill.label

          return (
            <div className="jobs-pill-wrap" key={pill.id}>
              <button
                className={`jobs-filter-pills__pill${isActive ? ' is-active' : ''}${isOpen ? ' is-open' : ''}${isAll && filterCount > 0 ? ' is-clear' : ''}`}
                type="button"
                onClick={() => {
                  if (isAll) { if (filterCount > 0) clearAllFilters(); return }
                  setActivePill(isOpen ? null : pill.id)
                }}
              >
                {pillLabel}
                {!isAll && (
                  <span className="pill-chevron">{isOpen ? '▲' : '▼'}</span>
                )}
              </button>
              {isOpen && renderPillPopover(pill.id)}
            </div>
          )
        })}
        {easyApplyOnly && (
          <span style={{ fontSize: '0.8rem', color: '#057642', background: '#e8f7ec', borderRadius: '999px', padding: '0.3rem 0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            ✓ Easy Apply active
          </span>
        )}
      </section>

      {eventNotice && <div className="jobs-event-notice">{eventNotice}</div>}

      {/* ── Toolbar ── */}
      <section className="jobs-toolbar">
        <label className="jobs-toolbar__field">
          <span>Sort by</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="relevance">Relevance</option>
            <option value="recent">Most recent</option>
            <option value="views">Most viewed</option>
          </select>
        </label>
        <button
          type="button"
          className={`jobs-toolbar__toggle${splitView ? ' is-active' : ''}`}
          onClick={() => setSplitView((v) => !v)}
        >
          {splitView ? 'Split view: ON' : 'Split view: OFF'}
        </button>
        <button
          type="button"
          className={`jobs-toolbar__toggle${jobAlertsEnabled ? ' is-active' : ''}`}
          onClick={() => {
            const next = !jobAlertsEnabled
            setJobAlertsEnabled(next)
            setEventNotice(next ? 'Job alert set.' : 'Job alert removed.')
            setTimeout(() => setEventNotice(''), 1500)
          }}
        >
          {jobAlertsEnabled ? '🔔 Alert: ON' : '🔕 Job alert'}
        </button>
      </section>

      {/* ── Main layout ── */}
      <section className="jobs-layout">
        <aside className="jobs-filters-sidebar" aria-label="Advanced filters">
          <h3>Filters</h3>

          <div className="jobs-filter-group">
            <h4>Employment Type</h4>
            {EMPLOYMENT_OPTIONS.map((value) => (
              <label key={value}>
                <input type="checkbox"
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
                <input type="checkbox"
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
                <input type="checkbox"
                  checked={remoteModes.includes(value)}
                  onChange={() => setRemoteModes((prev) => toggleInList(prev, value))}
                />
                <span>{value === 'onsite' ? 'On-site' : value.charAt(0).toUpperCase() + value.slice(1)}</span>
              </label>
            ))}
          </div>

          <div className="jobs-filter-group">
            <h4>Industry</h4>
            {INDUSTRY_OPTIONS.map((value) => (
              <label key={value}>
                <input type="checkbox"
                  checked={industries.includes(value)}
                  onChange={() => setIndustries((prev) => toggleInList(prev, value))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <div className="jobs-filter-group">
            <h4>Date Posted</h4>
            {DATE_OPTIONS.map((opt) => (
              <label key={opt.value}>
                <input type="radio" name="sidebar_date"
                  checked={dateFilter === opt.value}
                  onChange={() => setDateFilter(opt.value)}
                  style={{ accentColor: 'var(--li-blue)', width: 16, height: 16, margin: 0, flexShrink: 0, cursor: 'pointer' }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </aside>

        <section className={`jobs-split-pane${splitView ? '' : ' jobs-split-pane--single'}`}>
          <aside className="jobs-list">
            {loading && sortedJobs.length === 0 && (
              <><div className="job-card-skeleton" /><div className="job-card-skeleton" /><div className="job-card-skeleton" /></>
            )}
            {!loading && error && <div className="jobs-list__hint jobs-list__hint--error">{error}</div>}
            {!loading && !error && sortedJobs.length === 0 && (
              <div className="jobs-list__hint jobs-list__hint--empty">
                <h3>No jobs found</h3>
                <p>Try broader keywords or clear one of your filters.</p>
              </div>
            )}
            {sortedJobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                selected={job.job_id === selectedJobId}
                saved={savedJobIds.has(job.job_id)}
                onSelect={setSelectedJobId}
                onToggleSave={toggleSave}
              />
            ))}
            {loading && sortedJobs.length > 0 && <div className="jobs-list__loading-more">Loading more jobs…</div>}
            {!loading && hasMore && !error && (
              <button type="button" className="jobs-list__show-more" onClick={() => setPage((p) => p + 1)}>
                Show more jobs
              </button>
            )}
          </aside>

          {splitView && (
            <JobDetailPanel
              job={selectedJob}
              saved={selectedJob ? savedJobIds.has(selectedJob.job_id) : false}
              onToggleSave={toggleSave}
              onApply={applyToJob}
              applying={selectedJob ? applyingJobId === selectedJob.job_id : false}
            />
          )}
        </section>
      </section>
      {showApplyModal && targetJob && (
        <EasyApplyModal
          job={targetJob}
          user={user}
          onClose={() => setShowApplyModal(false)}
          onSubmit={handleModalSubmit}
          onSave={handleModalSave}
        />
      )}
    </main>
  )
}
