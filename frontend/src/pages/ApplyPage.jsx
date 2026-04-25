import { useState } from "react";
import { submitApplication } from "../api/applicationApi";

const LI = {
  blue: "#0A66C2", darkBlue: "#004182", lightBlue: "#70B5F9",
  bgMain: "#F3F2EF", bgCard: "#FFFFFF", bgBlueTint: "#DCE6F1",
  black: "#000000", darkGray: "#38434F", slate: "#56687A",
  silver: "#86888A", lightSilver: "#CACCCE",
  green: "#057642", greenBg: "#D7EBCE", greenText: "#44712E",
  amber: "#E7A33E", amberBg: "#FCE2BA",
  red: "#B24020", redBg: "#FADFD8",
};

export function StatusBadge({ status }) {
  const map = {
    submitted: { bg: LI.bgBlueTint, color: LI.darkBlue, label: "Submitted" },
    reviewed:  { bg: LI.amberBg,    color: "#915907",    label: "Reviewed"  },
    accepted:  { bg: LI.greenBg,    color: LI.greenText,  label: "Accepted"  },
    rejected:  { bg: LI.redBg,      color: LI.red,        label: "Rejected"  },
  };
  const m = map[status] || map.submitted;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 24,
      background: m.bg, color: m.color, fontSize: 12, fontWeight: 600,
    }}>{m.label}</span>
  );
}

const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 4,
  border: `1px solid #CACCCE`, fontSize: 14, color: "#38434F",
  background: "#FFFFFF", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};

function ConfirmationCard({ application, onReset }) {
  return (
    <div style={{
      background: LI.bgCard, border: `1px solid ${LI.lightSilver}`,
      borderRadius: 8, padding: 32, textAlign: "center",
      maxWidth: 500, margin: "32px auto",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: LI.greenBg,
        color: LI.greenText, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 26, margin: "0 auto 16px", fontWeight: 700,
      }}>✓</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: LI.black, margin: "0 0 8px" }}>
        Application submitted!
      </h2>
      <p style={{ color: LI.slate, fontSize: 14, margin: "0 0 20px" }}>
        The recruiter will review your application soon.
      </p>
      <div style={{ background: LI.bgMain, borderRadius: 8, padding: "14px 18px", textAlign: "left", marginBottom: 24 }}>
        {[["Application ID", application.application_id?.slice(0, 8) + "…"], ["Job ID", application.job_id]].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: LI.slate }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: LI.darkGray }}>{val}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: LI.slate }}>Status</span>
          <StatusBadge status={application.status} />
        </div>
      </div>
      <button onClick={onReset} style={{
        padding: "8px 24px", borderRadius: 24,
        border: `1.5px solid ${LI.blue}`, background: "transparent",
        color: LI.blue, fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
        Apply to another job
      </button>
    </div>
  );
}

export default function ApplyPage() {
  const [form, setForm] = useState({ job_id: "", member_id: "", recruiter_id: "", cover_letter: "", resume_text: "" });
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, resume_text: ev.target.result }));
    reader.readAsText(file);
  }

  function validate() {
    const e = {};
    if (!form.job_id.trim())      e.job_id      = "Job ID is required";
    if (!form.member_id.trim())   e.member_id   = "Member ID is required";
    if (!form.resume_text.trim()) e.resume_text = "Please upload or paste your resume";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const result = await submitApplication({
        job_id:       form.job_id.trim(),
        member_id:    form.member_id.trim(),
        recruiter_id: form.recruiter_id.trim() || undefined,
        cover_letter: form.cover_letter.trim() || undefined,
        resume_text:  form.resume_text.trim(),
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
    setErrors({}); setApiError(""); setSubmitted(null);
  }

  if (submitted) return <ConfirmationCard application={submitted} onReset={handleReset} />;

  return (
    <div style={{ background: LI.bgMain, minHeight: "100vh", padding: "24px 0" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LI.lightSilver}` }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: LI.black, margin: 0 }}>Apply for a Position</h1>
            <p style={{ color: LI.slate, fontSize: 14, margin: "4px 0 0" }}>
              Fields marked <span style={{ color: LI.red }}>*</span> are required
            </p>
          </div>

          {/* API error */}
          {apiError && (
            <div style={{ background: LI.redBg, borderBottom: `1px solid #f5c6bc`, padding: "12px 24px", color: LI.red, fontSize: 14 }}>
              {apiError}
            </div>
          )}

          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Job ID + Member ID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>
                  Job ID <span style={{ color: LI.red }}>*</span>
                </label>
                <input name="job_id" value={form.job_id} onChange={handleChange}
                  placeholder="e.g. job-001"
                  style={{ ...inp, borderColor: errors.job_id ? LI.red : LI.lightSilver }} />
                {errors.job_id && <p style={{ color: LI.red, fontSize: 12, margin: "4px 0 0" }}>{errors.job_id}</p>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>
                  Member ID <span style={{ color: LI.red }}>*</span>
                </label>
                <input name="member_id" value={form.member_id} onChange={handleChange}
                  placeholder="e.g. mem-001"
                  style={{ ...inp, borderColor: errors.member_id ? LI.red : LI.lightSilver }} />
                {errors.member_id && <p style={{ color: LI.red, fontSize: 12, margin: "4px 0 0" }}>{errors.member_id}</p>}
              </div>
            </div>

            {/* Recruiter ID */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>Recruiter ID</label>
              <input name="recruiter_id" value={form.recruiter_id} onChange={handleChange}
                placeholder="e.g. rec-001 (optional)" style={inp} />
            </div>

            {/* Resume upload */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>
                Upload Resume <span style={{ color: LI.red }}>*</span>
              </label>
              <div style={{
                position: "relative", border: `1.5px dashed ${errors.resume_text ? LI.red : LI.lightSilver}`,
                borderRadius: 4, padding: "18px 16px", textAlign: "center",
                background: LI.bgMain, cursor: "pointer",
              }}>
                <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFile}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                <div style={{ fontSize: 13, color: LI.slate }}>
                  {form.resume_text
                    ? `✓ Resume loaded (${form.resume_text.length.toLocaleString()} chars)`
                    : "Click to upload resume (.txt, .doc, .pdf)"}
                </div>
              </div>
              {errors.resume_text && <p style={{ color: LI.red, fontSize: 12, margin: "4px 0 0" }}>{errors.resume_text}</p>}
            </div>

            {/* Paste resume */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>
                Or paste resume text
              </label>
              <textarea name="resume_text" value={form.resume_text} onChange={handleChange}
                placeholder="Paste your resume content here…"
                style={{ ...inp, minHeight: 130, resize: "vertical" }} />
            </div>

            {/* Cover letter */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>Cover Letter</label>
              <textarea name="cover_letter" value={form.cover_letter} onChange={handleChange}
                placeholder="Write your cover letter here… (optional)"
                style={{ ...inp, minHeight: 100, resize: "vertical" }} />
            </div>

            {/* Submit button */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <button onClick={handleSubmit} disabled={loading}
                style={{
                  padding: "10px 24px", borderRadius: 24, border: "none",
                  background: loading ? LI.lightSilver : LI.blue,
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}>
                {loading ? "Submitting…" : "Submit application"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}