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

// ── Horizontal bar chart ─────────────────────────────────────────
function HBarChart({ data, labelKey, valueKey, color = '#0A66C2' }) {
  if (!data || data.length === 0) return <div style={{ color: '#56687A', fontSize: 13 }}>No data yet</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 100, fontSize: 12, color: '#38434F', textAlign: 'right', flexShrink: 0 }}>
            {String(d[labelKey] || 'Unknown').slice(0, 18)}
          </span>
          <div style={{ flex: 1, background: '#F3F2EF', borderRadius: 4, height: 16, position: 'relative' }}>
            <div style={{
              width: `${((d[valueKey] || 0) / max) * 100}%`,
              background: color, borderRadius: 4, height: '100%', minWidth: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#56687A', minWidth: 24, textAlign: 'right' }}>{d[valueKey]}</span>
        </div>
      ))}
    </div>
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

function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '16px 20px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
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
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>My Dashboard</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#56687A' }}>Profile analytics and application tracker</p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Profile views (30d)', value: totalViews },
          { label: 'Total applications', value: totalApps },
          { label: 'Accepted', value: acceptedApps },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
            padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#0A66C2' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#56687A' }}>{s.label}</div>
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
          systemPrompt={`You are a LinkedIn career coach AI. Analyze this member's dashboard data and provide 4-5 concise, actionable insights.
Focus on: profile visibility trends, application outcomes, areas for improvement, and encouraging next steps.
Be specific, warm, and constructive. Use bullet points (•). Keep it under 200 words.
Do not mention the word "data" — speak directly to the user as "you".`}
          data={{
            profile_views_last_30d: totalViews,
            views_by_day: views,
            total_applications: totalApps,
            accepted_applications: acceptedApps,
            application_status_breakdown: appStatus,
            recent_applications: apps.slice(0, 5).map(a => ({ job_id: a.job_id, status: a.status, date: a.created_at })),
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
