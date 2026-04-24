const BASE_URL = import.meta.env.VITE_APPLICATION_API_URL || "http://localhost:5003";

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export async function submitApplication(payload) {
  const res = await fetch(`${BASE_URL}/applications/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getApplication(application_id) {
  const res = await fetch(`${BASE_URL}/applications/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id }),
  });
  return handleResponse(res);
}

export async function getApplicationsByMember(member_id) {
  const res = await fetch(`${BASE_URL}/applications/byMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id }),
  });
  return handleResponse(res);
}

export async function getApplicationsByJob(job_id) {
  const res = await fetch(`${BASE_URL}/applications/byJob`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id }),
  });
  return handleResponse(res);
}

export async function updateApplicationStatus(application_id, status) {
  const res = await fetch(`${BASE_URL}/applications/updateStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id, status }),
  });
  return handleResponse(res);
}

export async function addRecruiterNote(application_id, recruiter_note) {
  const res = await fetch(`${BASE_URL}/applications/addNote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id, recruiter_note }),
  });
  return handleResponse(res);
}