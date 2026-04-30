function formatRelativeTime (isoDateString) {
  const now = Date.now()
  const then = new Date(isoDateString).getTime()
  if (!Number.isFinite(then)) return 'Recently'

  const diffMs = Math.max(0, now - then)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute))
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (diffMs < week) {
    const days = Math.floor(diffMs / day)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  const weeks = Math.floor(diffMs / week)
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`
}

export default function JobCard ({
  job,
  selected,
  saved,
  onSelect,
  onToggleSave
}) {
  return (
    <article
      className={`job-card${selected ? ' job-card--selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job.job_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(job.job_id)
      }}
    >
      <div className="job-card__logo" aria-hidden="true">
        {job.company.slice(0, 1)}
      </div>
      <div className="job-card__body">
        <div className="job-card__top-row">
          <h3 className="job-card__title">{job.title}</h3>
          <button
            type="button"
            className={`job-card__save-btn${saved ? ' is-saved' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave(job.job_id)
            }}
            aria-label={saved ? 'Unsave job' : 'Save job'}
            title={saved ? 'Saved' : 'Save'}
          >
            {saved ? '★' : '☆'}
          </button>
        </div>
        <p className="job-card__meta">{job.company}</p>
        <p className="job-card__meta">{job.location}</p>
        <p className="job-card__meta">{formatRelativeTime(job.postedAt)}</p>
        <p className="job-card__meta">{job.viewsCount} views</p>
        <div className="job-card__badges">
          {job.easyApply && <span className="job-badge">Easy Apply</span>}
          {job.profileMatch && <span className="job-badge job-badge--muted">Your profile matches</span>}
        </div>
      </div>
    </article>
  )
}
