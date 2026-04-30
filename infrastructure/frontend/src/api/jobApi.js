const JOB_BASE = '/api/v1/jobs';

async function jobJson(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export async function getJobById(job_id) {
  const res = await fetch(`${JOB_BASE}/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id }),
  });
  const data = await jobJson(res);
  return data;
}

export async function saveJob(job_id, user_id) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${JOB_BASE}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ job_id, user_id }),
  });
  return jobJson(res);
}

export async function getSavedJobs(user_id) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${JOB_BASE}/saved`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ user_id }),
  });
  const data = await jobJson(res);
  return data.jobs || [];
}

export async function searchJobs(params) {
  const res = await fetch(`${JOB_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page: 1, limit: 20, ...params }),
  });
  return jobJson(res);
}
