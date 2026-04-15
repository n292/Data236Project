import { useMemo, useState } from 'react'

const MOCK_JOBS = [
  {
    job_id: 'job-101',
    title: 'Software Engineer, Distributed Systems',
    company: 'LinkedIn',
    location: 'San Francisco Bay Area',
    postedLabel: '2 days ago',
    easyApply: true,
    profileMatch: true,
    applicantsCount: 38,
    description:
      'Build resilient backend services for high-scale member experiences. Partner with infra and product teams to deliver low-latency APIs.',
    skills: ['Node.js', 'Kafka', 'MySQL', 'Docker']
  },
  {
    job_id: 'job-102',
    title: 'Backend Engineer, Job Platform',
    company: 'Meta',
    location: 'Menlo Park, CA',
    postedLabel: '1 week ago',
    easyApply: false,
    profileMatch: true,
    applicantsCount: 72,
    description:
      'Own services powering job discovery and recommendation. Improve search relevance and throughput under burst traffic.',
    skills: ['Java', 'GraphQL', 'Redis', 'Kubernetes']
  },
  {
    job_id: 'job-103',
    title: 'Full Stack Engineer, Hiring Products',
    company: 'Google',
    location: 'Mountain View, CA',
    postedLabel: '2 weeks ago',
    easyApply: true,
    profileMatch: false,
    applicantsCount: 54,
    description:
      'Develop product features across frontend and service layers. Collaborate closely with design on recruiter workflows.',
    skills: ['React', 'TypeScript', 'Go', 'PostgreSQL']
  }
]

const FILTER_PILLS = [
  'Date posted',
  'LinkedIn features',
  'Company',
  'Experience level',
  'All filters'
]

export default function JobsPage () {
  const [selectedJobId, setSelectedJobId] = useState(MOCK_JOBS[0].job_id)
  const selectedJob = useMemo(
    () => MOCK_JOBS.find((j) => j.job_id === selectedJobId) || MOCK_JOBS[0],
    [selectedJobId]
  )

  return (
    <main className="jobs-page">
      <header className="jobs-topbar">
        <div className="jobs-topbar__brand">in</div>
        <div className="jobs-topbar__search">Search jobs, companies...</div>
      </header>

      <section className="jobs-search-row">
        <input
          className="jobs-search-row__input"
          value="Software engineer"
          readOnly
          aria-label="Job keyword search"
        />
        <span className="jobs-search-row__chip">San Francisco Bay Area</span>
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
          {MOCK_JOBS.map((job) => {
            const selected = job.job_id === selectedJobId
            return (
              <article
                key={job.job_id}
                className={`job-card${selected ? ' job-card--selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedJobId(job.job_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedJobId(job.job_id)
                }}
              >
                <div className="job-card__logo" aria-hidden="true">
                  {job.company.slice(0, 1)}
                </div>
                <div className="job-card__body">
                  <h3>{job.title}</h3>
                  <p className="job-card__meta">{job.company}</p>
                  <p className="job-card__meta">{job.location}</p>
                  <p className="job-card__meta">{job.postedLabel}</p>
                  <div className="job-card__badges">
                    {job.easyApply && <span className="job-badge">Easy Apply</span>}
                    {job.profileMatch && <span className="job-badge job-badge--muted">Your profile matches</span>}
                  </div>
                </div>
              </article>
            )
          })}
        </aside>

        <article className="job-detail-sticky">
          <p className="job-detail-sticky__kicker">{selectedJob.postedLabel}</p>
          <h2>{selectedJob.title}</h2>
          <p className="job-detail-sticky__company">{selectedJob.company}</p>
          <p className="job-detail-sticky__location">{selectedJob.location}</p>
          <div className="job-detail-sticky__cta">
            <button type="button" className="cta-primary">Easy Apply</button>
            <button type="button" className="cta-secondary">Save</button>
          </div>
          <h4>How you match</h4>
          <div className="job-detail-sticky__skills">
            {selectedJob.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
          <p className="job-detail-sticky__description">{selectedJob.description}</p>
          <p className="job-detail-sticky__applicants">
            See how you compare to {selectedJob.applicantsCount} applicants.
          </p>
        </article>
      </section>
    </main>
  )
}
