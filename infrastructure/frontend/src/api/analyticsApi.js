const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_API_URL || ''

async function get(path) {
  const res = await fetch(`${ANALYTICS_URL}${path}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Analytics request failed')
  return data
}

export async function getMemberDashboard(member_id) {
  return get(`/analytics/member/dashboard?member_id=${encodeURIComponent(member_id)}`)
}

export async function getRecruiterDashboard(recruiter_id) {
  return get(`/analytics/recruiter/dashboard?recruiter_id=${encodeURIComponent(recruiter_id)}`)
}

export async function getTopJobs(limit = 10) {
  return get(`/analytics/jobs/top?limit=${limit}`)
}

export async function getApplicationFunnel() {
  return get('/analytics/funnel')
}

export async function getGeoDistribution() {
  return get('/analytics/geo')
}
