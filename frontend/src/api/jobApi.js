const JOB_API_URL = import.meta.env.VITE_JOB_API_URL || "http://localhost:5002";

export async function getJobById(job_id) {
  const res = await fetch(`${JOB_API_URL}/jobs/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch job");
  return data.job;
}