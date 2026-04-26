const BASE_URL =
  import.meta.env.VITE_APPLICATION_API_URL || "http://localhost:5003";

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
  const formData = new FormData();
  formData.append("job_id", payload.job_id);
  formData.append("member_id", payload.member_id);

  if (payload.recruiter_id) {
    formData.append("recruiter_id", payload.recruiter_id);
  }

  if (payload.cover_letter) {
    formData.append("cover_letter", payload.cover_letter);
  }

  if (payload.resume) {
    formData.append("resume", payload.resume);
  }

  const res = await fetch(`${BASE_URL}/applications/submit`, {
    method: "POST",
    body: formData,
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