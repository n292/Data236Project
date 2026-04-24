import { useState } from "react";
import { submitApplication } from "../api/applicationApi";

/* ─── LinkedIn colour tokens ─── */
const LI = {
  blue: "#0A66C2",
  darkBlue: "#004182",
  lightBlue: "#70B5F9",
  bgMain: "#F3F2EF",
  bgCard: "#FFFFFF",
  bgBlueTint: "#DCE6F1",
  darkGray: "#38434F",
  slate: "#56687A",
  silver: "#CACCCE",
  green: "#057642",
  greenBg: "#D7EBCE",
  greenText: "#44712E",
  amber: "#E7A33E",
  amberBg: "#FCE2BA",
  red: "#B24020",
  redBg: "#FADFD8",
};

const STATUS_COLORS = {
  submitted: { bg: LI.bgBlueTint, text: LI.darkBlue, label: "Submitted" },
  reviewed: { bg: LI.amberBg, text: "#915907", label: "Reviewed" },
  accepted: { bg: LI.greenBg, text: LI.greenText, label: "Accepted" },
  rejected: { bg: LI.redBg, text: LI.red, label: "Rejected" },
};

/* ─── Reusable status badge ─── */
export function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.submitted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 24,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Field component ─── */
function Field({ label, required, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: LI.darkGray,
        }}
      >
        {label}
        {required && (
          <span style={{ color: LI.red, marginLeft: 3 }}>*</span>
        )}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: 12, color: LI.slate }}>{hint}</span>
      )}
    </div>
  );
}

/* ─── Input styles ─── */
const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${LI.silver}`,
  fontSize: 14,
  color: LI.darkGray,
  background: LI.bgCard,
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

/* ─── Confirmation card after successful submit ─── */
function ConfirmationCard({ application, onReset }) {
  return (
    <div
      style={{
        background: LI.bgCard,
        border: `1px solid ${LI.silver}`,
        borderRadius: 8,
        padding: 32,
        textAlign: "center",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {/* Green check circle */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: LI.greenBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 28,
        }}
      >
        ✓
      </div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#000",
          margin: "0 0 8px",
        }}
      >
        Application Submitted!
      </h2>
      <p style={{ color: LI.slate, fontSize: 14, margin: "0 0 24px" }}>
        Your application has been received. The recruiter will review it soon.
      </p>

      {/* Application details */}
      <div
        style={{
          background: LI.bgMain,
          borderRadius: 8,
          padding: "16px 20px",
          textAlign: "left",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: LI.slate }}>Application ID</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: LI.darkGray, fontFamily: "monospace" }}>
            {application.application_id?.slice(0, 8)}…
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: LI.slate }}>Status</span>
          <StatusBadge status={application.status} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: LI.slate }}>Job ID</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: LI.darkGray }}>{application.job_id}</span>
        </div>
      </div>

      <button
        onClick={onReset}
        style={{
          padding: "10px 28px",
          borderRadius: 24,
          border: `1.5px solid ${LI.blue}`,
          background: "transparent",
          color: LI.blue,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Apply to another job
      </button>
    </div>
  );
}

/* ─── Main Apply Page ─── */
export default function ApplyPage() {
  const [form, setForm] = useState({
    job_id: "",
    member_id: "",
    recruiter_id: "",
    cover_letter: "",
    resume_text: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  /* Handle file upload — read as text for resume_text field */
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => ({ ...prev, resume_text: ev.target.result }));
    };
    reader.readAsText(file);
  }

  function validate() {
    const newErrors = {};
    if (!form.job_id.trim()) newErrors.job_id = "Job ID is required";
    if (!form.member_id.trim()) newErrors.member_id = "Member ID is required";
    if (!form.resume_text.trim()) newErrors.resume_text = "Resume is required";
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const result = await submitApplication({
        job_id: form.job_id.trim(),
        member_id: form.member_id.trim(),
        recruiter_id: form.recruiter_id.trim() || undefined,
        cover_letter: form.cover_letter.trim() || undefined,
        resume_text: form.resume_text.trim(),
      });
      setSubmitted(result.application);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({ job_id: "", member_id: "", recruiter_id: "", cover_letter: "", resume_text: "" });
    setErrors({});
    setApiError("");
    setSubmitted(null);
  }

  if (submitted) {
    return (
      <div style={{ padding: "32px 0" }}>
        <ConfirmationCard application={submitted} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "24px 0" }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#000", margin: "0 0 6px" }}>
          Apply for a Position
        </h1>
        <p style={{ color: LI.slate, fontSize: 14, margin: 0 }}>
          Complete the form below to submit your application. Fields marked{" "}
          <span style={{ color: LI.red }}>*</span> are required.
        </p>
      </div>

      {/* Error banner */}
      {apiError && (
        <div
          style={{
            background: LI.redBg,
            border: `1px solid #f5c6bc`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            color: LI.red,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {apiError}
        </div>
      )}

      {/* Form card */}
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.silver}`,
          borderRadius: 8,
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Job + Member row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Job ID" required>
            <input
              style={{ ...inputStyle, borderColor: errors.job_id ? LI.red : LI.silver }}
              name="job_id"
              value={form.job_id}
              onChange={handleChange}
              placeholder="e.g. job-001"
            />
            {errors.job_id && (
              <span style={{ fontSize: 12, color: LI.red }}>{errors.job_id}</span>
            )}
          </Field>

          <Field label="Member ID" required>
            <input
              style={{ ...inputStyle, borderColor: errors.member_id ? LI.red : LI.silver }}
              name="member_id"
              value={form.member_id}
              onChange={handleChange}
              placeholder="e.g. mem-001"
            />
            {errors.member_id && (
              <span style={{ fontSize: 12, color: LI.red }}>{errors.member_id}</span>
            )}
          </Field>
        </div>

        {/* Recruiter ID (optional) */}
        <Field label="Recruiter ID" hint="Optional — fill in if you know the recruiter's ID">
          <input
            style={inputStyle}
            name="recruiter_id"
            value={form.recruiter_id}
            onChange={handleChange}
            placeholder="e.g. rec-001"
          />
        </Field>

        {/* Resume upload */}
        <Field label="Resume" required hint="Upload a .txt file, or paste your resume text below">
          <div
            style={{
              border: `1.5px dashed ${errors.resume_text ? LI.red : LI.silver}`,
              borderRadius: 8,
              padding: "20px 16px",
              textAlign: "center",
              background: LI.bgMain,
              cursor: "pointer",
              position: "relative",
            }}
          >
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileChange}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
            <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
            <p style={{ fontSize: 13, color: LI.slate, margin: 0 }}>
              {form.resume_text && form.resume_text.length > 0
                ? `Resume loaded (${form.resume_text.length} chars)`
                : "Click to upload your resume"}
            </p>
          </div>
          {errors.resume_text && (
            <span style={{ fontSize: 12, color: LI.red }}>{errors.resume_text}</span>
          )}
        </Field>

        {/* Resume textarea (paste fallback) */}
        <Field label="Or paste resume text" hint="You can paste your resume content here instead of uploading">
          <textarea
            style={{
              ...inputStyle,
              minHeight: 140,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            name="resume_text"
            value={form.resume_text}
            onChange={handleChange}
            placeholder="Paste your resume content here…"
          />
        </Field>

        {/* Cover letter */}
        <Field label="Cover Letter" hint="Optional — briefly explain why you're a great fit">
          <textarea
            style={{
              ...inputStyle,
              minHeight: 110,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            name="cover_letter"
            value={form.cover_letter}
            onChange={handleChange}
            placeholder="Write your cover letter here…"
          />
        </Field>

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "11px 36px",
              borderRadius: 24,
              border: "none",
              background: loading ? LI.slate : LI.blue,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}