export async function fetchTopJobs() {
  const response = await fetch("http://127.0.0.1:8000/analytics/jobs/top");
  return response.json();
}

export async function fetchJobClicks() {
  const response = await fetch("http://127.0.0.1:8000/analytics/jobs/clicks");
  return response.json();
}

export async function fetchSavedTrend() {
  const response = await fetch("http://127.0.0.1:8000/analytics/jobs/saved-trend");
  return response.json();
}

export async function fetchProfileViews(memberId) {
  const response = await fetch(`http://127.0.0.1:8000/analytics/member/profile-views?member_id=${memberId}`);
  return response.json();
}

export async function fetchStatusBreakdown() {
  const response = await fetch("http://127.0.0.1:8000/analytics/member/status-breakdown");
  return response.json();
}

export async function fetchLowTractionJobs() {
  const response = await fetch("http://127.0.0.1:8000/analytics/jobs/low-traction");
  return response.json();
}

export async function fetchGeoAnalytics() {
  const response = await fetch("http://127.0.0.1:8000/analytics/geo");
  return response.json();
}

export async function fetchFunnelAnalytics() {
  const response = await fetch("http://127.0.0.1:8000/analytics/funnel");
  return response.json();
}