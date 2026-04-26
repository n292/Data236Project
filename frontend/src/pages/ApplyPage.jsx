import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { submitApplication } from "../api/applicationApi";
import { CURRENT_MEMBER, DEMO_JOBS, getJobById } from "../data/demoJobs";

const LI = {
  blue: "#0A66C2",
  darkBlue: "#004182",
  lightBlue: "#70B5F9",
  bgMain: "#F3F2EF",
  bgCard: "#FFFFFF",
  bgBlueTint: "#DCE6F1",
  black: "#000000",
  darkGray: "#38434F",
  slate: "#56687A",
  silver: "#86888A",
  lightSilver: "#CACCCE",
  green: "#057642",
  greenBg: "#D7EBCE",
  greenText: "#44712E",
  red: "#B24020",
  redBg: "#FADFD8",
};

const inp = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${LI.lightSilver}`,
  fontSize: 14,
  color: LI.darkGray,
  background: LI.bgCard,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function StatusBadge({ status }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 24,
        background: LI.bgBlueTint,
        color: LI.darkBlue,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {status === "submitted" ? "Submitted" : status}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0" }}>
      <span style={{ color: LI.slate, fontSize: 13 }}>{label}</span>
      <span style={{ color: LI.darkGray, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ConfirmationCard({ application, job, member, onApplyAnother }) {
  return (
    <div
      style={{
        background: LI.bgCard,
        border: `1px solid ${LI.lightSilver}`,
        borderRadius: 12,
        padding: 28,
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: LI.greenBg,
          color: LI.greenText,
          fontSize: 28,
          fontWeight: 800,
          marginBottom: 16,
        }}
      >
        ✓
      </div>

      <h1 style={{ margin: 0, fontSize: 28, color: LI.black }}>
        Application submitted successfully
      </h1>

      <p style={{ margin: "10px 0 24px", color: LI.slate, fontSize: 15, lineHeight: 1.6 }}>
        Your application has been created for <strong>{job.title}</strong> at{" "}
        <strong>{job.company}</strong>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: LI.bgMain, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: LI.slate, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            Job summary
          </div>
          <InfoRow label="Job" value={`${job.title} (${job.job_id})`} />
          <InfoRow label="Company" value={job.company} />
          <InfoRow label="Recruiter ID" value={job.recruiter_id} />
        </div>

        <div style={{ background: LI.bgMain, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: LI.slate, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            Application summary
          </div>
          <InfoRow label="Applicant" value={`${member.name} (${member.member_id})`} />
          <InfoRow label="Application ID" value={application.application_id} />
          <InfoRow label="Resume file" value={application.resume_file_name || "Uploaded PDF"} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
            <span style={{ color: LI.slate, fontSize: 13 }}>Status</span>
            <StatusBadge status={application.status} />
          </div>
        </div>
      </div>

      <button
        onClick={onApplyAnother}
        style={{
          border: "none",
          background: LI.blue,
          color: "#fff",
          borderRadius: 24,
          padding: "11px 18px",
          fontWeight: 700,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Apply for another job
      </button>
    </div>
  );
}

export default function ApplyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedJob = useMemo(() => {
    if (location.state?.job?.job_id) return location.state.job;
    const fromQuery = searchParams.get("jobId");
    if (fromQuery) return getJobById(fromQuery);
    return DEMO_JOBS[0];
  }, [location.state, searchParams]);

  const currentMember = useMemo(() => {
    const saved = localStorage.getItem("currentMember");
    if (!saved) return CURRENT_MEMBER;
    try {
      return JSON.parse(saved);
    } catch {
      return CURRENT_MEMBER;
    }
  }, []);

  const [form, setForm] = useState({
    job_id: selectedJob?.job_id || "",
    member_id: currentMember?.member_id || "",
    recruiter_id: selectedJob?.recruiter_id || "",
    cover_letter: "",
  });

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    if (!selectedJob) return;
    setForm((prev) => ({
      ...prev,
      job_id: selectedJob.job_id,
      recruiter_id: selectedJob.recruiter_id || "",
      member_id: currentMember.member_id,
    }));
  }, [selectedJob, currentMember]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setResumeFileName(file.name);

    setErrors((prev) => ({ ...prev, resume: "" }));
    setApiError("");
  }

  function validate() {
    const nextErrors = {};
    if (!form.job_id.trim()) nextErrors.job_id = "Job was not selected";
    if (!form.member_id.trim()) nextErrors.member_id = "Member is missing";
    if (!form.recruiter_id.trim()) nextErrors.recruiter_id = "Recruiter is missing";
    if (!resumeFile) nextErrors.resume = "Please upload your resume PDF";
    return nextErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await submitApplication({
        job_id: form.job_id,
        member_id: form.member_id,
        recruiter_id: form.recruiter_id,
        cover_letter: form.cover_letter.trim(),
        resume: resumeFile,
      });
      setSubmitted(result.application);
    } catch (error) {
      setApiError(error.message || "Could not submit application");
    } finally {
      setLoading(false);
    }
  }

  if (!selectedJob) {
    return (
      <section
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>No job selected</h1>
        <p style={{ color: LI.slate }}>Open the Jobs page and choose a job before applying.</p>
        <button
          onClick={() => navigate("/jobs")}
          style={{
            border: "none",
            background: LI.blue,
            color: "#fff",
            borderRadius: 24,
            padding: "10px 18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Go to Jobs
        </button>
      </section>
    );
  }

  if (submitted) {
    return (
      <ConfirmationCard
        application={submitted}
        job={selectedJob}
        member={currentMember}
        onApplyAnother={() => navigate("/jobs")}
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 20, alignItems: "start" }}>
      <section
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 24, borderBottom: `1px solid ${LI.lightSilver}` }}>
          <div style={{ fontSize: 12, color: LI.slate, textTransform: "uppercase", fontWeight: 700 }}>
            Applying to selected job
          </div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28, color: LI.black }}>{selectedJob.title}</h1>
          <div style={{ color: LI.darkGray, fontWeight: 700 }}>{selectedJob.company}</div>
          <div style={{ color: LI.slate, marginTop: 6, fontSize: 14 }}>
            {selectedJob.location} • {selectedJob.employment_type} • {selectedJob.workplace_type}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: LI.black, marginBottom: 8 }}>
              Job description
            </div>
            <p style={{ color: LI.darkGray, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              {selectedJob.description}
            </p>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: LI.black, marginBottom: 8 }}>
              What the system auto-fills
            </div>
            <div
              style={{
                background: LI.bgMain,
                borderRadius: 10,
                padding: 16,
                border: `1px solid ${LI.lightSilver}`,
              }}
            >
              <InfoRow label="Job ID" value={form.job_id} />
              <InfoRow label="Member ID" value={form.member_id} />
              <InfoRow label="Recruiter ID" value={form.recruiter_id} />
            </div>

            {(errors.job_id || errors.member_id || errors.recruiter_id) && (
              <p style={{ color: LI.red, fontSize: 12, marginTop: 8 }}>
                {errors.job_id || errors.member_id || errors.recruiter_id}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 24, borderBottom: `1px solid ${LI.lightSilver}` }}>
          <h2 style={{ margin: 0, fontSize: 22, color: LI.black }}>Submit application</h2>
          <p style={{ margin: "6px 0 0", color: LI.slate, fontSize: 14 }}>
            Upload your resume as a PDF. Cover letter is optional. IDs are sent automatically from the selected job and current member.
          </p>
        </div>

        {apiError && (
          <div style={{ background: LI.redBg, color: LI.red, padding: "12px 24px", fontSize: 14 }}>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              background: LI.bgBlueTint,
              border: `1px solid ${LI.lightSilver}`,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 13, color: LI.darkBlue, fontWeight: 700, marginBottom: 6 }}>
              Applicant
            </div>
            <div style={{ fontSize: 15, color: LI.black, fontWeight: 700 }}>{currentMember.name}</div>
            <div style={{ fontSize: 13, color: LI.slate, marginTop: 4 }}>{currentMember.headline}</div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 14, color: LI.darkGray }}>
              Upload resume PDF <span style={{ color: LI.red }}>*</span>
            </label>

            <div
              style={{
                position: "relative",
                border: `1.5px dashed ${errors.resume ? LI.red : LI.lightSilver}`,
                borderRadius: 8,
                padding: "18px 16px",
                textAlign: "center",
                background: LI.bgMain,
                cursor: "pointer",
              }}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFile}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                }}
              />
              <div style={{ fontSize: 13, color: LI.slate }}>
                {resumeFileName
                  ? `Resume selected: ${resumeFileName}`
                  : "Click to upload resume (.pdf)"}
              </div>
            </div>

            {errors.resume && (
              <p style={{ color: LI.red, fontSize: 12, margin: "6px 0 0" }}>{errors.resume}</p>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 14, color: LI.darkGray }}>
              Cover letter <span style={{ color: LI.silver }}>(optional)</span>
            </label>
            <textarea
              name="cover_letter"
              value={form.cover_letter}
              onChange={handleChange}
              placeholder="Write your cover letter here..."
              style={{ ...inp, minHeight: 120, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                border: "none",
                background: loading ? LI.lightBlue : LI.blue,
                color: "#fff",
                borderRadius: 24,
                padding: "11px 18px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/jobs")}
              style={{
                border: `1px solid ${LI.blue}`,
                background: "#fff",
                color: LI.blue,
                borderRadius: 24,
                padding: "11px 18px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Back to jobs
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}