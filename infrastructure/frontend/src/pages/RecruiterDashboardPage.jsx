import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRecruiterDashboard } from '../api/analyticsApi'
import { getAiMetrics } from '../api/aiApi'
import AIInsightsCard from '../components/analytics/AIInsightsCard'

function HBarChart({ data, labelKey, valueKey, color = '#0A66C2', emptyMsg = 'No data yet' }) {
  if (!data || data.length === 0) return <p style={{ fontSize: 13, color: '#56687A', margin: 0 }}>{emptyMsg}</p>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 160, fontSize: 12, color: '#38434F', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(d[labelKey] || 'Unknown')}
          </span>
          <div style={{ flex: 1, background: '#F3F2EF', borderRadius: 4, height: 18 }}>
            <div style={{ width: `${((d[valueKey] || 0) / max) * 100}%`, background: color, borderRadius: 4, height: '100%', minWidth: 4 }} />
          </div>
          <span style={{ fontSize: 12, color: '#56687A', minWidth: 28, textAlign: 'right', fontWeight: 600 }}>{d[valueKey]}</span>
        </div>
      ))}
    </div>
  )
}

function BarChart({ data, xKey, yKey, color = '#0A66C2', height = 100 }) {
  if (!data || data.length === 0) return <p style={{ fontSize: 13, color: '#56687A', margin: 0 }}>No data yet</p>
  const max = Math.max(...data.map(d => d[yKey] || 0), 1)
  const barW = Math.max(10, Math.floor(440 / data.length) - 4)
  return (
    <svg width="100%" viewBox={`0 0 460 ${height + 24}`}>
      {data.map((d, i) => {
        const h = Math.max(2, ((d[yKey] || 0) / max) * height)
        const x = i * (barW + 4) + 2
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={barW} height={h} rx={2} fill={color} opacity={0.85} />
            {data.length <= 14 && (
              <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="#56687A">
                {String(d[xKey] || '').slice(-5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Card({ title, description, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '16px 20px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
      {description && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#56687A' }}>{description}</p>}
      {children}
    </div>
  )
}

export default function RecruiterDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobsForAI, setJobsForAI] = useState([])
  const [aiMetrics, setAiMetrics] = useState(null)
  const [notification, setNotification] = useState(null)

  const recruiterId = user?.member_id

  useEffect(() => {
    if (!recruiterId) return
    setLoading(true)
    setError('')
    getRecruiterDashboard(recruiterId)
      .then(d => setData(d))
      .catch(e => {
        const msg = e.message || ''
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connect')) {
          setError('analytics_offline')
        } else {
          setError(msg)
        }
      })
      .finally(() => setLoading(false))
  }, [recruiterId])

  useEffect(() => {
    getAiMetrics().then(d => setAiMetrics(d)).catch(() => {})
  }, [])

  // Always fetch jobs directly so AI card has data even if analytics is offline
  useEffect(() => {
    if (!recruiterId) return
    const token = localStorage.getItem('token')
    fetch('/api/v1/jobs/byRecruiter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ recruiter_id: recruiterId, page: 1, limit: 50 }),
    })
      .then(r => r.json())
      .then(b => setJobsForAI(Array.isArray(b.jobs) ? b.jobs : []))
      .catch(() => {})
  }, [recruiterId])

  // Real-time updates via SSE
  useEffect(() => {
    if (!recruiterId) return
    const sse = new EventSource(`/api/events/recruiter/live-feed/${recruiterId}`)
    
    sse.addEventListener('update', (e) => {
      const data = JSON.parse(e.data)
      if (data.topic === 'application.submitted') {
        setNotification(`New application received for job: ${data.event.payload.job_id}`)
        setTimeout(() => setNotification(null), 5000)
        // Refresh dashboard data
        getRecruiterDashboard(recruiterId).then(d => setData(d)).catch(() => {})
      }
    })

    return () => sse.close()
  }, [recruiterId])

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 16px' }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: '#057642', color: '#fff',
          padding: '12px 24px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 10000, animation: 'slideIn 0.3s ease-out'
        }}>
          <strong>{notification}</strong>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Recruiter Dashboard</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#56687A' }}>
              Analytics for your job postings and candidate pipeline
              {user && <> · <strong>{user.first_name} {user.last_name}</strong></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/recruiter/jobs/new"
              style={{ background: '#0A66C2', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              + Post a Job
            </Link>
            <Link to="/recruiter/jobs"
              style={{ border: '1px solid #0A66C2', color: '#0A66C2', padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Manage Jobs
            </Link>
          </div>
        </div>
      </div>

      {/* Quick-action cards — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Post a Job',          to: '/recruiter/jobs/new',      desc: 'Create a new job posting',           bg: '#0A66C2' },
          { label: 'Review Applications', to: '/applications/review',     desc: 'See who applied to your jobs',       bg: '#057642' },
          { label: 'Browse Talent',       to: '/members/search',          desc: 'Search member profiles',             bg: '#915907' },
        ].map(({ label, to, desc, bg }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
              padding: '16px 18px', cursor: 'pointer',
              transition: 'box-shadow 0.15s, transform 0.15s',
              boxSizing: 'border-box',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, marginBottom: 10, flexShrink: 0 }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'rgba(0,0,0,0.9)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#56687A' }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics offline banner */}
      {error === 'analytics_offline' && (
        <div style={{ background: '#fffbf0', border: '1px solid #e8c94c', borderRadius: 8, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'rgba(0,0,0,0.9)' }}>Analytics service is offline</div>
            <div style={{ fontSize: 13, color: '#56687A', marginTop: 2 }}>Charts will appear here once the analytics service is running. Your jobs and applications still work normally.</div>
          </div>
        </div>
      )}

      {/* Generic error */}
      {error && error !== 'analytics_offline' && (
        <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#56687A', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8 }}>
          Loading analytics…
        </div>
      )}

      {!loading && data && (() => {
        // Build job_id → title map from live jobs data
        const jobMap = {}
        jobsForAI.forEach(j => { jobMap[j.job_id] = j.title || j.job_id })

        // Derive location breakdown from live jobs (not analytics)
        const locMap = {}
        jobsForAI.forEach(j => {
          const loc = j.location || 'Unknown'
          locMap[loc] = (locMap[loc] || 0) + 1
        })
        const byLocation = Object.entries(locMap)
          .sort((a, b) => b[1] - a[1])
          .map(([location, jobs]) => ({ label: location, count: jobs }))

        return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card title="Top Jobs by Applications" description="Which of your jobs attracted the most applicants">
              <HBarChart
                data={(data.top_jobs || []).map(j => ({ label: jobMap[j.job_id] || j.job_id, count: j.applications }))}
                labelKey="label" valueKey="count" color="#0A66C2"
                emptyMsg="No applications received yet."
              />
            </Card>
            <Card title="Job Postings by Location" description="Geographic distribution of your job postings">
              <HBarChart
                data={byLocation}
                labelKey="label" valueKey="count" color="#057642"
                emptyMsg="No location data yet."
              />
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card title="Low-Traction Jobs" description="Jobs with 2 or fewer applications — consider boosting these">
              {(data.low_traction || []).length === 0
                ? <p style={{ fontSize: 13, color: '#057642', margin: 0, fontWeight: 600 }}>All your jobs have good traction!</p>
                : <HBarChart
                    data={(data.low_traction || []).map(j => ({ label: jobMap[j.job_id] || j.job_id, count: j.applications }))}
                    labelKey="label" valueKey="count" color="#C0392B"
                  />
              }
            </Card>
            <Card title="Job Views Over Time" description="Daily view counts across all your postings">
              <BarChart data={data.job_views || []} xKey="date" yKey="views" color="#915907" />
            </Card>
          </div>

          <Card title="Job Saves Over Time" description="How many candidates saved your jobs per day">
            <BarChart data={data.job_saves || []} xKey="date" yKey="saves" color="#0A66C2" height={80} />
          </Card>
        </>
        )
      })()}

      {/* Empty state when analytics is up but no data yet */}
      {!loading && !data && !error && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 48, textAlign: 'center', color: '#56687A' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'rgba(0,0,0,0.7)', marginBottom: 8 }}>No analytics data yet</div>
          <p style={{ margin: 0, fontSize: 14 }}>Post a job and track applications to see your dashboard populate.</p>
          <Link to="/recruiter/jobs/new" style={{ display: 'inline-block', marginTop: 16, background: '#0A66C2', color: '#fff', padding: '10px 24px', borderRadius: 999, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            Post your first job
          </Link>
        </div>
      )}

      {/* AI Shortlist Metrics */}
      {aiMetrics && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>AI Shortlist Evaluation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Tasks Run',         value: aiMetrics.total_tasks ?? '—' },
              { label: 'Completed',          value: aiMetrics.completed ?? '—' },
              { label: 'Avg Top Score',      value: aiMetrics.avg_top_score != null ? `${aiMetrics.avg_top_score}` : '—' },
              { label: 'Approval Rate',      value: aiMetrics.approval_rate != null ? `${Math.round(aiMetrics.approval_rate * 100)}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#F3F2EF', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0A66C2' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#56687A', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Link to="/applications/review" style={{ fontSize: 13, color: '#0A66C2', fontWeight: 600, textDecoration: 'none' }}>
              Run AI Shortlist → Applicant Review
            </Link>
          </div>
        </div>
      )}

      {/* AI Insights — always visible once jobs are loaded */}
      {jobsForAI.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <AIInsightsCard
            title="Recruiter Intelligence"
            systemPrompt={`You are a LinkedIn recruiting strategist AI. Analyze this recruiter's job postings and application pipeline.
Provide 4-5 specific, actionable insights and recommendations.
Focus on: which jobs are performing well vs. struggling, location spread, seniority mix, salary competitiveness, and concrete next steps.
Use bullet points (•). Be direct and professional. Keep it under 220 words.
Speak directly — say "your jobs" not "the data".`}
            data={{
              total_jobs: jobsForAI.length,
              jobs: jobsForAI.map(j => ({
                job_id: j.job_id,
                title: j.title,
                location: j.location,
                status: j.status,
                applicants: j.applicants_count,
                views: j.views_count,
                salary_min: j.salary_min,
                salary_max: j.salary_max,
                employment_type: j.employment_type,
              })),
              analytics: data ? {
                top_jobs: data.top_jobs || [],
                low_traction: data.low_traction || [],
                funnel: data.funnel || [],
              } : 'analytics service offline',
            }}
          />
        </div>
      )}
    </div>
  )
}
