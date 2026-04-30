const BASE = ''  // use Vite proxy — /ai/* → http://127.0.0.1:8005

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || 'AI request failed')
  return data
}

export function submitAiTask({ job_id, job_skills, job_seniority, resumes, recruiter_id }) {
  return req('/ai/submit-task', {
    method: 'POST',
    body: JSON.stringify({ job_id, job_skills, job_seniority, resumes, recruiter_id }),
  })
}

export function getAiTask(task_id) {
  return req(`/ai/hiring-task/${task_id}`)
}

export function approveAiTask(task_id, decision = 'approved', note = '') {
  return req(`/ai/hiring-task/${task_id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  })
}

export function getAiMetrics(task_id) {
  return req(task_id ? `/ai/metrics/${task_id}` : '/ai/metrics')
}

/** Returns an EventSource for SSE task progress. Caller must close it. */
export function streamAiTask(task_id) {
  return new EventSource(`/ai/task-stream/${task_id}`)
}

export function getCareerCoachAnalysis({ member_skills, headline, target_job, target_skills, years_experience }) {
  return req('/ai/career-coach', {
    method: 'POST',
    body: JSON.stringify({ member_skills, headline, target_job, target_skills, years_experience }),
  })
}
