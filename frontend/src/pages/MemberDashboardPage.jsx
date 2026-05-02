import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMemberDashboard } from '../api/analyticsApi'
import { getApplicationsByMember } from '../api/applicationApi'
import AIInsightsCard from '../components/analytics/AIInsightsCard'

// ── Mini bar chart (SVG) ──────────────────────────────────────────
function BarChart({ data, xKey, yKey, color = '#0A66C2', height = 120 }) {
  if (!data || data.length === 0) return <div style={{ color: '#56687A', fontSize: 13 }}>No data yet</div>
  const max = Math.max(...data.map(d => d[yKey] || 0), 1)
  const barW = Math.max(8, Math.floor(440 / data.length) - 3)
  return (
    <svg width="100%" viewBox={`0 0 460 ${height + 24}`} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const h = Math.max(2, ((d[yKey] || 0) / max) * height)
        const x = i * (barW + 3) + 2
        const y = height - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} opacity={0.85} />
            {data.length <= 15 && (
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

// ── Pie/donut chart (SVG) ─────────────────────────────────────────
const STATUS_PALETTE = { submitted: '#0A66C2', reviewed: '#915907', accepted: '#057642', rejected: '#C0392B' }

function DonutChart({ data, labelKey, valueKey }) {
  if (!data || data.length === 0) return <div style={{ color: '#56687A', fontSize: 13 }}>No data yet</div>
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0)
  if (total === 0) return <div style={{ color: '#56687A', fontSize: 13 }}>No data yet</div>
  const r = 50, cx = 70, cy = 60, stroke = 18
  let cumAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d[valueKey] / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle)
    const y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle)
    const y2 = cy + r * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    const colors = Object.values(STATUS_PALETTE)
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, color: STATUS_PALETTE[d[labelKey]] || colors[i % colors.length], angle }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={140} height={120}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={stroke} />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#38434F">{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fill="#56687A">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => {
          const colors = Object.values(STATUS_PALETTE)
          const col = STATUS_PALETTE[d[labelKey]] || colors[i % colors.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: col, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#38434F', textTransform: 'capitalize' }}>{d[labelKey]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#38434F', marginLeft: 4 }}>{d[valueKey]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ title, description, children }) {
  return (
    <div className="li-card">
      <h3 className="li-card__title">{title}</h3>
      {description && <p className="li-card__desc">{description}</p>}
      {children}
    </div>
  )
}

export default function MemberDashboardPage() {
  const memberId = localStorage.getItem('viewer_id') || ''
  const [views, setViews] = useState([])
  const [appStatus, setAppStatus] = useState([])
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!memberId) { setLoading(false); return }
    Promise.all([
      getMemberDashboard(memberId).catch(() => ({ profile_views: [], application_status: [] })),
      getApplicationsByMember(memberId).catch(() => []),
    ]).then(([dash, appList]) => {
      setViews(dash.profile_views || [])
      setAppStatus(dash.application_status || [])
      // Build status counts from applications if analytics has no data
      if ((dash.application_status || []).length === 0 && Array.isArray(appList)) {
        const counts = {}
        appList.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })
        setAppStatus(Object.entries(counts).map(([status, count]) => ({ status, count })))
      }
      setApps(Array.isArray(appList) ? appList : [])
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false))
  }, [memberId])

  if (!memberId) return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 16px', textAlign: 'center', color: '#56687A' }}>
      <div style={{ fontSize: 40 }}>👤</div>
      <p>No member selected. <Link to="/members/search" style={{ color: '#0A66C2' }}>Search for a profile</Link> and view it first.</p>
    </div>
  )

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#56687A' }}>Loading dashboard…</div>
  if (error) return <div className="alert error-alert" style={{ maxWidth: 860, margin: '24px auto' }}>{error}</div>

  const totalViews = views.reduce((s, d) => s + (d.views || 0), 0)
  const totalApps = apps.length
  const acceptedApps = apps.filter(a => a.status === 'accepted').length

  return (
    <div className="li-dashboard">
      <header className="li-page-header">
        <div>
          <h1 className="li-page-header__title">Dashboard</h1>
          <p className="li-page-header__subtitle">
            Profile analytics and application activity — same layout recruiters use for hiring insights.
          </p>
        </div>
        <div className="li-page-header__actions">
          <Link to="/jobs" className="li-btn li-btn--secondary">Browse jobs</Link>
          {memberId && (
            <Link to={`/members/${memberId}`} className="li-btn li-btn--primary">View profile</Link>
          )}
        </div>
      </header>

      {/* Summary stats */}
      <div className="li-stat-grid">
        {[
          { label: 'Profile views (30d)', value: totalViews },
          { label: 'Total applications', value: totalApps },
          { label: 'Accepted', value: acceptedApps },
        ].map(s => (
          <div key={s.label} className="li-stat-card">
            <div className="li-stat-card__value">{s.value}</div>
            <div className="li-stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Profile Views — Last 30 Days">
          <BarChart data={views} xKey="date" yKey="views" color="#0A66C2" />
          {views.length === 0 && <p style={{ fontSize: 13, color: '#56687A' }}>No profile view events recorded yet. View a profile page to generate data.</p>}
        </Card>

        <Card title="Applications by Status">
          <DonutChart data={appStatus} labelKey="status" valueKey="count" />
          {appStatus.length === 0 && <p style={{ fontSize: 13, color: '#56687A' }}>No applications yet. <Link to="/jobs" style={{ color: '#0A66C2' }}>Browse jobs</Link>.</p>}
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <AIInsightsCard
          title="Career Insights"
          onAnalyze={async () => {
            const res = await fetch('/ai/career-insights/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                member_id: memberId,
                profile_views_last_30d: totalViews,
                views_by_day: views,
                total_applications: totalApps,
                accepted_applications: acceptedApps,
                application_status_breakdown: appStatus,
                recent_applications: apps.slice(0, 5).map(a => ({
                  job_id: a.job_id,
                  status: a.status,
                  date: a.created_at,
                })),
              }),
            })
            if (!res.ok) throw new Error(`AI service error: ${res.status}`)
            const body = await res.json()
            return body.insights
          }}
        />
      </div>

      <Card title="Recent Applications">
        {apps.length === 0 ? (
          <p style={{ fontSize: 14, color: '#56687A', margin: 0 }}>No applications yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apps.slice(0, 5).map(app => (
              <div key={app.application_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F2EF' }}>
                <div>
                  <Link to={`/jobs/${app.job_id}`} style={{ fontWeight: 600, fontSize: 14, color: '#0A66C2', textDecoration: 'none' }}>
                    Job #{app.job_id?.slice(0, 8)}
                  </Link>
                  <div style={{ fontSize: 12, color: '#56687A' }}>
                    {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
                <span style={{
                  background: STATUS_PALETTE[app.status] ? STATUS_PALETTE[app.status] + '22' : '#F3F2EF',
                  color: STATUS_PALETTE[app.status] || '#56687A',
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                }}>
                  {app.status}
                </span>
              </div>
            ))}
            {apps.length > 5 && (
              <Link to="/applications" style={{ fontSize: 13, color: '#0A66C2' }}>
                View all {apps.length} applications →
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
