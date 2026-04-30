const BASE_URL =
  import.meta.env.VITE_APPLICATION_API_URL || "/api/applications";

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error("Backend returned invalid JSON");
    }
  } else {
    if (rawText.startsWith("<!DOCTYPE") || rawText.startsWith("<html")) {
      throw new Error(
        `Expected JSON from ${res.url}, but received HTML instead. Check that the backend is running and the API URL is correct: ${BASE_URL}`
      );
    }

    throw new Error(rawText || "Server returned a non-JSON response");
  }

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

export async function submitApplication(payload) {
  const isMultipart = !!payload.resume_file;
  
  let body;
  let headers = { ...authHeaders() };

  if (isMultipart) {
    body = new FormData();
    body.append("job_id", payload.job_id);
    body.append("member_id", payload.member_id);
    if (payload.recruiter_id) body.append("recruiter_id", payload.recruiter_id);
    if (payload.resume_ref) body.append("resume_ref", payload.resume_ref);
    if (payload.cover_letter) body.append("cover_letter", payload.cover_letter);
    body.append("metadata", JSON.stringify(payload.metadata || {}));
    body.append("is_draft", payload.is_draft ? "true" : "false");
    body.append("resume", payload.resume_file);
    // Don't set Content-Type header; fetch will set it with boundary
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      job_id: payload.job_id,
      member_id: payload.member_id,
      recruiter_id: payload.recruiter_id,
      resume_ref: payload.resume_ref,
      cover_letter: payload.cover_letter,
      metadata: payload.metadata,
      is_draft: !!payload.is_draft
    });
  }

  const res = await fetch(`${BASE_URL}/submit`, {
    method: "POST",
    headers,
    body,
  });

  return handleResponse(res);
}

export async function getApplication(application_id) {
  const res = await fetch(`${BASE_URL}/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ application_id }),
  });
  return handleResponse(res);
}

export async function getApplicationsByMember(member_id) {
  const res = await fetch(`${BASE_URL}/byMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ member_id }),
  });
  return handleResponse(res);
}

export async function getApplicationsByJob(job_id) {
  const res = await fetch(`${BASE_URL}/byJob`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ job_id }),
  });
  return handleResponse(res);
}

export async function updateApplicationStatus(application_id, status) {
  const res = await fetch(`${BASE_URL}/updateStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ application_id, status }),
  });
  return handleResponse(res);
}

export async function addRecruiterNote(application_id, recruiter_note) {
  const res = await fetch(`${BASE_URL}/addNote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ application_id, recruiter_note }),
  });
  return handleResponse(res);
}

export async function getDraft(jobId, memberId) {
  const res = await fetch(`${BASE_URL}/draft/${jobId}/${memberId}`, {
    headers: authHeaders()
  });
  if (res.status === 404) return null;
  return handleResponse(res);
}