function companyInitial (name) {
  const s = (name || '?').trim()
  return s.slice(0, 1).toUpperCase()
}

function formatPostedLine (postedAt) {
  if (!postedAt) return ''
  const d = new Date(postedAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function JobDetailPanel ({
  job,
  saved,
  onToggleSave,
  onApply,
  applying
}) {
  if (!job) {
    return (
      <article className="job-detail-panel job-detail-panel--empty">
        <p className="job-detail-panel__empty">Select a job to view details.</p>
      </article>
    )
  }

  const postedLine = formatPostedLine(job.postedAt)
  const employment = job.employmentType || 'Full-time'
  const remote = job.remote ? String(job.remote) : 'onsite'
  const remoteLabel =
    remote === 'remote' ? 'Remote' : remote === 'hybrid' ? 'Hybrid' : 'On-site'

  return (
    <article className="job-detail-panel">
      <header className="job-detail-panel__header">
        <div className="job-detail-panel__logo" aria-hidden="true">
          {companyInitial(job.company)}
        </div>
        <div className="job-detail-panel__header-text">
          <h2 className="job-detail-panel__title">{job.title}</h2>
          <p className="job-detail-panel__company">{job.company}</p>
          <p className="job-detail-panel__meta">
            {job.location}
            {postedLine && (
              <>
                {' · '}
                <span className="job-detail-panel__posted">Posted {postedLine}</span>
              </>
            )}
          </p>
          <p className="job-detail-panel__submeta">
            {employment}
            {' · '}
            {remoteLabel}
            {' · '}
            {job.viewsCount} views
          </p>
        </div>
      </header>

      <div className="job-detail-panel__cta-row">
        <button
          type="button"
          className="job-detail-panel__cta job-detail-panel__cta--primary"
          onClick={() => onApply(job)}
          disabled={applying}
        >
          {applying ? 'Applying...' : 'Easy Apply'}
        </button>
        <button
          type="button"
          className={`job-detail-panel__cta job-detail-panel__cta--outline${saved ? ' is-saved' : ''}`}
          onClick={() => onToggleSave(job.job_id)}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <section className="job-detail-panel__section">
        <h3 className="job-detail-panel__section-title">How you match</h3>
        <p className="job-detail-panel__stub">
          Skill overlap and experience fit will appear here once profile matching is wired (stub).
        </p>
        {job.skills.length > 0 && (
          <div className="job-detail-panel__skills">
            {job.skills.map((skill) => (
              <span key={skill} className="job-detail-panel__skill-tag">
                {skill}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="job-detail-panel__section">
        <h3 className="job-detail-panel__section-title">About the job</h3>
        <div className="job-detail-panel__description">
          {job.descriptionHtml ? (
            <div
              className="job-detail-panel__description-html"
              dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
            />
          ) : (
            <p className="job-detail-panel__description-text">{job.description}</p>
          )}
        </div>
      </section>

      <footer className="job-detail-panel__footer">
        <p className="job-detail-panel__applicants">
          See how you compare to{' '}
          <strong>{job.applicantsCount}</strong> applicants.
        </p>
      </footer>
    </article>
  )
}
