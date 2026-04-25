import { useState, useEffect, useCallback } from "react";
import { getApplicationsByJob, getApplication, updateApplicationStatus, addRecruiterNote } from "../api/applicationApi";

const LI = {
  blue: "#0A66C2", darkBlue: "#004182", lightBlue: "#70B5F9",
  bgMain: "#F3F2EF", bgCard: "#FFFFFF", bgBlueTint: "#DCE6F1",
  black: "#000000", darkGray: "#38434F", slate: "#56687A",
  silver: "#86888A", lightSilver: "#CACCCE",
  green: "#057642", greenBg: "#D7EBCE", greenText: "#44712E",
  amber: "#E7A33E", amberBg: "#FCE2BA",
  red: "#B24020", redBg: "#FADFD8", coral: "#F5987E",
};

const STATUSES = ["submitted", "reviewed", "accepted", "rejected"];
const STATUS_META = {
  submitted: { bg: LI.bgBlueTint,  color: LI.darkBlue,  label: "Submitted", icon: "📨" },
  reviewed:  { bg: LI.amberBg,     color: "#915907",     label: "Reviewed",  icon: "👁️"  },
  accepted:  { bg: LI.greenBg,     color: LI.greenText,  label: "Accepted",  icon: "✅" },
  rejected:  { bg: LI.redBg,       color: LI.red,        label: "Rejected",  icon: "❌" },
};

/* ── Spinner ── */
function Spinner({ size = 16 }) {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        display: "inline-block", width: size, height: size,
        border: `2px solid ${LI.lightSilver}`,
        borderTop: `2px solid ${LI.blue}`,
        borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
      }} />
    </>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status, large = false }) {
  const m = STATUS_META[status] || STATUS_META.submitted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: large ? "4px 14px" : "2px 10px",
      borderRadius: 24,
      background: m.bg, color: m.color,
      fontSize: large ? 13 : 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {m.icon} {m.label}
    </span>
  );
}

/* ── Avatar with initials ── */
function Avatar({ name, size = 40 }) {
  const initials = (name || "?").split(/[-_\s]/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = [
    ["#DCE6F1", "#004182"], ["#D7EBCE", "#44712E"],
    ["#FCE2BA", "#915907"], ["#FADFD8", "#B24020"],
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  const [bg, fg] = colors[idx];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.36, flexShrink: 0,
      border: `2px solid ${LI.lightSilver}`,
    }}>{initials}</div>
  );
}

/* ── Date formatter ── */
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Input style ── */
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 6,
  border: `1px solid ${LI.lightSilver}`, fontSize: 14, color: LI.darkGray,
  background: LI.bgCard, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.15s",
};

/* ── Stat Card ── */
function StatCard({ status, count, isActive, onClick }) {
  const m = STATUS_META[status];
  return (
    <div onClick={onClick} style={{
      background: isActive ? m.bg : LI.bgCard,
      border: `1.5px solid ${isActive ? m.color : LI.lightSilver}`,
      borderRadius: 10, padding: "14px 16px", textAlign: "center",
      cursor: "pointer", transition: "all 0.15s",
      transform: isActive ? "translateY(-2px)" : "none",
      boxShadow: isActive ? `0 4px 12px ${m.bg}` : "none",
    }}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>{m.icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? m.color : LI.darkGray }}>{count}</div>
      <div style={{ fontSize: 11, color: isActive ? m.color : LI.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
        {m.label}
      </div>
    </div>
  );
}

/* ── Applicant row in left list ── */
function ApplicantRow({ app, isSelected, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 16px", cursor: "pointer",
      background: isSelected ? LI.bgBlueTint : LI.bgCard,
      borderBottom: `1px solid ${LI.lightSilver}`,
      borderLeft: `3px solid ${isSelected ? LI.blue : "transparent"}`,
      transition: "all 0.12s",
    }}>
      <Avatar name={app.member_id} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: LI.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {app.member_id}
        </div>
        <div style={{ fontSize: 12, color: LI.slate, marginTop: 2 }}>Applied {formatDate(app.created_at)}</div>
      </div>
      <StatusBadge status={app.status} />
    </div>
  );
}

/* ── Actions tab ── */
function ActionsTab({ app, onStatusUpdate, onNoteAdd, updatingStatus, addingNote }) {
  const [selected, setSelected] = useState(app.status);
  const [note, setNote]         = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => { setSelected(app.status); setNote(""); setNoteSaved(false); }, [app.application_id, app.status]);

  async function saveStatus() {
    if (selected === app.status) return;
    await onStatusUpdate(app.application_id, selected);
  }

  async function saveNote() {
    if (!note.trim()) return;
    await onNoteAdd(app.application_id, note.trim());
    setNote(""); setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 3000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Status update */}
      <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 4px" }}>Update Application Status</p>
        <p style={{ fontSize: 12, color: LI.slate, margin: "0 0 14px" }}>Select a new status and click Save to update.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {STATUSES.map(s => {
            const m = STATUS_META[s];
            const active = selected === s;
            return (
              <button key={s} onClick={() => setSelected(s)} style={{
                padding: "7px 16px", borderRadius: 24, cursor: "pointer",
                border: active ? `2px solid ${m.color}` : `1px solid ${LI.lightSilver}`,
                background: active ? m.bg : LI.bgCard,
                color: active ? m.color : LI.slate,
                fontSize: 13, fontWeight: 600, transition: "all 0.12s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
        <button onClick={saveStatus} disabled={updatingStatus || selected === app.status} style={{
          padding: "9px 22px", borderRadius: 24, border: "none",
          background: (selected === app.status || updatingStatus) ? LI.lightSilver : LI.blue,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: (selected === app.status || updatingStatus) ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
          transition: "background 0.15s",
        }}>
          {updatingStatus ? <><Spinner /> Saving…</> : "Save Status"}
        </button>
        {selected !== app.status && (
          <span style={{ fontSize: 12, color: LI.amber, marginLeft: 12, fontWeight: 600 }}>
            ⚠ Unsaved change
          </span>
        )}
      </div>

      {/* Recruiter note */}
      <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 4px" }}>Recruiter Note</p>
        <p style={{ fontSize: 12, color: LI.slate, margin: "0 0 12px" }}>Private notes visible only to the recruiting team.</p>

        {app.recruiter_note && (
          <div style={{
            background: LI.amberBg, border: `1px solid ${LI.amber}`,
            borderRadius: 8, padding: "12px 14px", marginBottom: 14,
            fontSize: 13, color: "#5c3a00", lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, color: "#915907", fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
              📌 Current Note
            </div>
            {app.recruiter_note}
          </div>
        )}

        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Add a note about this candidate…"
          style={{ ...inp, minHeight: 90, resize: "vertical", marginBottom: 12 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={saveNote} disabled={addingNote || !note.trim()} style={{
            padding: "9px 22px", borderRadius: 24, border: "none",
            background: (addingNote || !note.trim()) ? LI.lightSilver : LI.blue,
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: (addingNote || !note.trim()) ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            {addingNote ? <><Spinner /> Saving…</> : "Add Note"}
          </button>
          {noteSaved && <span style={{ fontSize: 13, color: LI.green, fontWeight: 600 }}>✓ Note saved!</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Full application detail panel ── */
function AppDetail({ appId, onStatusChanged }) {
  const [app, setApp]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [tab, setTab]               = useState("overview");
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setApp(await getApplication(appId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusUpdate(id, status) {
    setUpdatingStatus(true);
    try {
      const r = await updateApplicationStatus(id, status);
      setApp(r.application);
      setSuccessMsg(`Status updated to "${STATUS_META[status]?.label}"`);
      setTimeout(() => setSuccessMsg(""), 3500);
      onStatusChanged?.(id, status);
    } catch (e) { setError(e.message); }
    finally { setUpdatingStatus(false); }
  }

  async function handleNoteAdd(id, recruiter_note) {
    setAddingNote(true);
    try { const r = await addRecruiterNote(id, recruiter_note); setApp(r.application); }
    catch (e) { setError(e.message); }
    finally { setAddingNote(false); }
  }

  if (loading) return (
    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", height: 220, gap: 10, color: LI.slate, fontSize: 14 }}>
      <Spinner /> Loading application…
    </div>
  );
  if (error) return (
    <div style={{ background: LI.redBg, border: `1px solid ${LI.coral}`, borderRadius: 10, padding: "16px 20px", color: LI.red, fontSize: 14 }}>
      ⚠ {error}
    </div>
  );
  if (!app) return null;

  const tabs = [
    { id: "overview", label: "📋 Overview" },
    { id: "resume",   label: "📄 Resume"   },
    { id: "actions",  label: "⚙️ Actions"  },
  ];

  return (
    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

      {/* Candidate header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LI.lightSilver}`, background: LI.bgCard, display: "flex", alignItems: "flex-start", gap: 14 }}>
        <Avatar name={app.member_id} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: LI.black, marginBottom: 4 }}>
            {app.member_id}
          </div>
          <div style={{ fontSize: 13, color: LI.slate, marginBottom: 10 }}>
            Applied {formatDate(app.created_at)} · Job: <strong style={{ color: LI.darkGray }}>{app.job_id}</strong>
          </div>
          <StatusBadge status={app.status} large />
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ background: LI.greenBg, padding: "10px 24px", fontSize: 13, color: LI.greenText, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${LI.lightSilver}`, background: LI.bgCard }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 20px", border: "none",
            borderBottom: tab === t.id ? `2px solid ${LI.blue}` : "2px solid transparent",
            background: "transparent",
            color: tab === t.id ? LI.blue : LI.slate,
            fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer", transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: LI.bgMain, padding: "20px" }}>

        {/* Overview */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 14px" }}>Application Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                {[
                  ["Application ID", <span key="id" style={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all", color: LI.slate }}>{app.application_id}</span>],
                  ["Job ID",         <strong key="jid" style={{ color: LI.blue }}>{app.job_id}</strong>],
                  ["Member ID",      app.member_id],
                  ["Recruiter ID",   app.recruiter_id || <em style={{ color: LI.silver }}>Not assigned</em>],
                  ["Status",         <StatusBadge key="s" status={app.status} />],
                  ["Applied On",     formatDate(app.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: LI.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, color: LI.darkGray }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {app.cover_letter ? (
              <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 10px" }}>✉️ Cover Letter</p>
                <p style={{ fontSize: 14, color: LI.darkGray, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{app.cover_letter}</p>
              </div>
            ) : (
              <div style={{ background: LI.bgCard, border: `1px dashed ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px", color: LI.silver, fontSize: 13, textAlign: "center" }}>
                No cover letter submitted
              </div>
            )}

            {app.recruiter_note && (
              <div style={{ background: LI.amberBg, border: `1px solid ${LI.amber}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#915907", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>📌 Recruiter Note</div>
                <p style={{ fontSize: 13, color: "#5c3a00", lineHeight: 1.7, margin: 0 }}>{app.recruiter_note}</p>
              </div>
            )}
          </div>
        )}

        {/* Resume */}
        {tab === "resume" && (
          app.resume_text ? (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: 0 }}>📄 Resume Content</p>
                <span style={{
                  fontSize: 12, color: LI.slate, background: LI.bgMain,
                  padding: "3px 10px", borderRadius: 12, border: `1px solid ${LI.lightSilver}`,
                }}>
                  {app.resume_text.length.toLocaleString()} chars
                </span>
              </div>
              <pre style={{
                background: "#FAFAFA", borderRadius: 8, padding: "16px",
                fontSize: 13, color: LI.darkGray, lineHeight: 1.75,
                overflowX: "auto", overflowY: "auto", maxHeight: 420,
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "ui-monospace, 'Courier New', monospace",
                border: `1px solid ${LI.lightSilver}`,
              }}>{app.resume_text}</pre>
            </div>
          ) : (
            <div style={{ background: LI.bgCard, border: `1px dashed ${LI.lightSilver}`, borderRadius: 10, padding: "48px 20px", textAlign: "center", color: LI.slate, fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 600, color: LI.darkGray, marginBottom: 4 }}>No resume submitted</div>
              <div style={{ fontSize: 13 }}>This applicant did not upload a resume.</div>
            </div>
          )
        )}

        {/* Actions */}
        {tab === "actions" && (
          <ActionsTab app={app} onStatusUpdate={handleStatusUpdate} onNoteAdd={handleNoteAdd}
            updatingStatus={updatingStatus} addingNote={addingNote} />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main RecruiterReviewPage
══════════════════════════════════════════════ */
export default function RecruiterReviewPage() {
  const [inputJobId, setInputJobId]     = useState("");
  const [jobId, setJobId]               = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [selectedId, setSelectedId]     = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  async function handleSearch(e) {
    e.preventDefault();
    if (!inputJobId.trim()) return;
    setLoading(true); setError(""); setApplications([]); setSelectedId(null); setFilterStatus("all");
    try {
      const data = await getApplicationsByJob(inputJobId.trim());
      setApplications(Array.isArray(data) ? data : []);
      setJobId(inputJobId.trim());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleStatusChanged(id, status) {
    setApplications(prev => prev.map(a => a.application_id === id ? { ...a, status } : a));
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s).length;
    return acc;
  }, {});

  const filtered = filterStatus === "all"
    ? applications
    : applications.filter(a => a.status === filterStatus);

  return (
    <div style={{ background: LI.bgMain, minHeight: "100vh", padding: "24px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: LI.black, margin: "0 0 4px" }}>
            Recruiter — Applicant Review
          </h1>
          <p style={{ color: LI.slate, fontSize: 14, margin: 0 }}>
            Enter a Job ID to load all applicants, then select a candidate to review their details.
          </p>
        </div>

        {/* Search card */}
        <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>
                Job ID
              </label>
              <input
                value={inputJobId}
                onChange={e => setInputJobId(e.target.value)}
                placeholder="e.g. job-001"
                style={inp}
                onFocus={e => e.target.style.borderColor = LI.blue}
                onBlur={e => e.target.style.borderColor = LI.lightSilver}
              />
            </div>
            <button type="submit" disabled={loading || !inputJobId.trim()} style={{
              padding: "10px 26px", borderRadius: 24, border: "none",
              background: (loading || !inputJobId.trim()) ? LI.lightSilver : LI.blue,
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: (loading || !inputJobId.trim()) ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 8, height: 42,
              transition: "background 0.15s",
            }}>
              {loading ? <><Spinner /> Loading…</> : "Load Applicants"}
            </button>
          </form>
        </div>

        {/* Error alert */}
        {error && (
          <div style={{ background: LI.redBg, border: `1px solid ${LI.coral}`, borderRadius: 10, padding: "14px 18px", color: LI.red, fontSize: 14, marginBottom: 18, display: "flex", gap: 8, alignItems: "flex-start" }}>
            ⚠ {error}
          </div>
        )}

        {/* Results area */}
        {applications.length > 0 && (
          <>
            {/* Stats row — clickable to filter */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
              {STATUSES.map(s => (
                <StatCard key={s} status={s} count={counts[s]}
                  isActive={filterStatus === s}
                  onClick={() => setFilterStatus(prev => prev === s ? "all" : s)}
                />
              ))}
            </div>

            {/* Filter pill tabs */}
            <div style={{
              display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap",
            }}>
              {[{ id: "all", label: `All Applicants (${applications.length})` },
                ...STATUSES.map(s => ({ id: s, label: `${STATUS_META[s].icon} ${STATUS_META[s].label} (${counts[s]})` }))
              ].map(t => (
                <button key={t.id} onClick={() => setFilterStatus(t.id)} style={{
                  padding: "6px 14px", borderRadius: 20, border: "none",
                  background: filterStatus === t.id ? LI.blue : LI.bgCard,
                  color: filterStatus === t.id ? "#fff" : LI.slate,
                  fontSize: 13, fontWeight: filterStatus === t.id ? 700 : 400,
                  cursor: "pointer",
                  border: filterStatus === t.id ? `1px solid ${LI.blue}` : `1px solid ${LI.lightSilver}`,
                  transition: "all 0.12s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Two-column layout */}
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>

              {/* Left list */}
              <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{
                  padding: "10px 16px", background: LI.bgMain,
                  borderBottom: `1px solid ${LI.lightSilver}`,
                  fontSize: 12, fontWeight: 600, color: LI.slate,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>{filtered.length} Applicant{filtered.length !== 1 ? "s" : ""}</span>
                  {filterStatus !== "all" && (
                    <button onClick={() => setFilterStatus("all")} style={{
                      fontSize: 11, color: LI.blue, background: "none", border: "none",
                      cursor: "pointer", fontWeight: 600, padding: 0,
                    }}>Clear filter ×</button>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: LI.slate, fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                    No applicants with this status
                  </div>
                ) : (
                  filtered.map(app => (
                    <ApplicantRow key={app.application_id} app={app}
                      isSelected={selectedId === app.application_id}
                      onClick={() => setSelectedId(app.application_id)} />
                  ))
                )}
              </div>

              {/* Right detail panel */}
              <div>
                {selectedId ? (
                  <AppDetail key={selectedId} appId={selectedId} onStatusChanged={handleStatusChanged} />
                ) : (
                  <div style={{
                    background: LI.bgCard, border: `1px dashed ${LI.lightSilver}`,
                    borderRadius: 10, padding: "60px 32px", textAlign: "center", color: LI.slate,
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>
                      Select a candidate
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Click an applicant on the left to view their full application, resume, and take action.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state after search */}
        {!loading && jobId && applications.length === 0 && !error && (
          <div style={{
            background: LI.bgCard, border: `1px solid ${LI.lightSilver}`,
            borderRadius: 10, padding: "60px 32px", textAlign: "center", color: LI.slate,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>
              No applications found
            </div>
            <div style={{ fontSize: 13 }}>
              No one has applied to job <strong style={{ color: LI.darkGray }}>{jobId}</strong> yet.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}