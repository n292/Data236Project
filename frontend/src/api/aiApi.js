const BASE = ''  // Vite proxy: /ai/* → http://127.0.0.1:8005

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || 'AI request failed')
  return data
}

// ── Legacy endpoints (kept for backward compat) ──────────────────────────────

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

// ── New Shortlist endpoints ───────────────────────────────────────────────────

/** Create a shortlist task — AI service fetches all data itself. */
export function createShortlistTask({ job_id, recruiter_id, top_n = 5, include_outreach = true }) {
  return req('/ai/tasks/create', {
    method: 'POST',
    body: JSON.stringify({ job_id, recruiter_id, top_n, include_outreach }),
  })
}

/** Poll task status (lightweight — no shortlist payload). */
export function getShortlistTask(task_id) {
  return req(`/ai/tasks/${task_id}`)
}

/** Fetch full results including scored candidates and outreach drafts. */
export function getShortlistResults(task_id) {
  return req(`/ai/tasks/${task_id}/results`)
}

/** Approve the entire shortlist (all pending drafts marked approved). */
export function approveShortlist(task_id, note = '') {
  return req(`/ai/tasks/${task_id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

/** Save an edited outreach draft for one candidate and mark them approved. */
export function editAndApprove(task_id, { candidate_id, edited_subject, edited_message, note = '' }) {
  return req(`/ai/tasks/${task_id}/edit-and-approve`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id, edited_subject, edited_message, note }),
  })
}

/** Reject the entire shortlist. */
export function rejectShortlist(task_id, reason = '') {
  return req(`/ai/tasks/${task_id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** Approve a single candidate and send only their outreach message. */
export function approveCandidate(task_id, candidate_id, note = '') {
  return req(`/ai/tasks/${task_id}/approve-candidate`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id, note }),
  })
}

/** Reject a single candidate without affecting others. */
export function rejectCandidate(task_id, candidate_id, reason = '') {
  return req(`/ai/tasks/${task_id}/reject-candidate`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id, reason }),
  })
}
