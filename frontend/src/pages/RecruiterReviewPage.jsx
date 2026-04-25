import { useState, useEffect, useCallback } from "react";
import { getApplicationsByJob, getApplication, updateApplicationStatus, addRecruiterNote } from "../api/applicationApi";

const LI = {
  blue: "#0A66C2", darkBlue: "#004182", lightBlue: "#70B5F9",
  bgMain: "#F3F2EF", bgCard: "#FFFFFF", bgBlueTint: "#DCE6F1",
  black: "#000000", darkGray: "#38434F", slate: "#56687A",
  silver: "#86888A", lightSilver: "#CACCCE",
  green: "#057642", greenBg: "#D7EBCE", greenText: "#44712E",
  amber: "#E7A33E", amberBg: "#FCE2BA",
  red: "#B24020", redBg: "#FADFD8",
};

const STATUSES = ["submitted", "reviewed", "accepted", "rejected"];
const STATUS_META = {
  submitted: { bg: LI.bgBlueTint, color: LI.darkBlue,  label: "Submitted" },
  reviewed:  { bg: LI.amberBg,    color: "#915907",     label: "Reviewed"  },
  accepted:  { bg: LI.greenBg,    color: LI.greenText,  label: "Accepted"  },
  rejected:  { bg: LI.redBg,      color: LI.red,        label: "Rejected"  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.submitted;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 24,
      background: m.bg, color: m.color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
}

function Avatar({ name, size = 40 }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: LI.bgBlueTint, color: LI.darkBlue,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
    }}>{initials}</div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 16, height: 16,
      border: `2px solid ${LI.lightSilver}`,
      borderTop: `2px solid ${LI.blue}`,
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
    }} />
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 4,
  border: `1px solid #CACCCE`, fontSize: 14, color: "#38434F",
  background: "#FFFFFF", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

/* ── Applicant row in left list ── */
function ApplicantRow({ app, isSelected, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", cursor: "pointer",
      background: isSelected ? LI.bgBlueTint : LI.bgCard,
      borderBottom: `1px solid ${LI.lightSilver}`,
      borderLeft: `3px solid ${isSelected ? LI.blue : "transparent"}`,
      transition: "background 0.1s",
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

/* ── Actions tab: update status + add note ── */
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
      <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "18px 20px" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 12px" }}>Update Status</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {STATUSES.map(s => {
            const m = STATUS_META[s];
            const active = selected === s;
            return (
              <button key={s} onClick={() => setSelected(s)} style={{
                padding: "6px 16px", borderRadius: 24, cursor: "pointer",
                border: active ? `2px solid ${LI.blue}` : `1px solid ${LI.lightSilver}`,
                background: active ? m.bg : LI.bgCard,
                color: active ? m.color : LI.slate,
                fontSize: 13, fontWeight: 600, transition: "all 0.1s",
              }}>{m.label}</button>
            );
          })}
        </div>
        <button onClick={saveStatus} disabled={updatingStatus || selected === app.status} style={{
          padding: "8px 22px", borderRadius: 24, border: "none",
          background: (selected === app.status || updatingStatus) ? LI.lightSilver : LI.blue,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: (selected === app.status || updatingStatus) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {updatingStatus ? <><Spinner /> Saving…</> : "Save status"}
        </button>
      </div>

      {/* Recruiter note */}
      <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "18px 20px" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 8px" }}>Recruiter Note</p>
        {app.recruiter_note && (
          <div style={{
            background: LI.amberBg, border: `1px solid ${LI.amber}`,
            borderRadius: 6, padding: "10px 14px", marginBottom: 12,
            fontSize: 13, color: "#5c3a00", lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, color: "#915907", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Saved note</div>
            {app.recruiter_note}
          </div>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Add a note about this candidate…"
          style={{ ...inp, minHeight: 80, resize: "vertical", marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={saveNote} disabled={addingNote || !note.trim()} style={{
            padding: "8px 22px", borderRadius: 24, border: "none",
            background: (addingNote || !note.trim()) ? LI.lightSilver : LI.blue,
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: (addingNote || !note.trim()) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {addingNote ? <><Spinner /> Saving…</> : "Add note"}
          </button>
          {noteSaved && <span style={{ fontSize: 13, color: LI.green, fontWeight: 600 }}>✓ Note saved</span>}
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: LI.slate }}>
      <Spinner /> Loading application…
    </div>
  );
  if (error) return (
    <div style={{ background: LI.redBg, border: `1px solid #f5c6bc`, borderRadius: 8, padding: "14px 18px", color: LI.red, fontSize: 14 }}>{error}</div>
  );
  if (!app) return null;

  const tabs = [{ id: "overview", label: "Overview" }, { id: "resume", label: "Resume" }, { id: "actions", label: "Actions" }];

  return (
    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, overflow: "hidden" }}>

      {/* Candidate header */}
      <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LI.lightSilver}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
        <Avatar name={app.member_id} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: LI.black, marginBottom: 4 }}>
            Candidate: {app.member_id}
          </div>
          <div style={{ fontSize: 13, color: LI.slate, marginBottom: 8 }}>
            Applied {formatDate(app.created_at)} · Job: {app.job_id}
          </div>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ background: LI.greenBg, padding: "10px 22px", fontSize: 13, color: LI.greenText, fontWeight: 600 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${LI.lightSilver}`, background: LI.bgCard }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 18px", border: "none",
            borderBottom: tab === t.id ? `2px solid ${LI.blue}` : "2px solid transparent",
            background: "transparent",
            color: tab === t.id ? LI.blue : LI.slate,
            fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer", transition: "all 0.1s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: LI.bgMain, padding: "18px 20px" }}>

        {/* Overview */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "16px 20px" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 12px" }}>Application Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                {[
                  ["Application ID", <span key="id" style={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{app.application_id}</span>],
                  ["Job ID", app.job_id],
                  ["Member ID", app.member_id],
                  ["Recruiter ID", app.recruiter_id || "—"],
                  ["Status", <StatusBadge key="s" status={app.status} />],
                  ["Applied On", formatDate(app.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: LI.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, color: LI.darkGray }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {app.cover_letter && (
              <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "16px 20px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: "0 0 8px" }}>Cover Letter</p>
                <p style={{ fontSize: 14, color: LI.darkGray, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{app.cover_letter}</p>
              </div>
            )}

            {app.recruiter_note && (
              <div style={{ background: LI.amberBg, border: `1px solid ${LI.amber}`, borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#915907", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recruiter Note</div>
                <p style={{ fontSize: 13, color: "#5c3a00", lineHeight: 1.6, margin: 0 }}>{app.recruiter_note}</p>
              </div>
            )}
          </div>
        )}

        {/* Resume */}
        {tab === "resume" && (
          app.resume_text ? (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: LI.black, margin: 0 }}>Resume</p>
                <span style={{ fontSize: 12, color: LI.slate }}>{app.resume_text.length.toLocaleString()} chars</span>
              </div>
              <pre style={{
                background: LI.bgMain, borderRadius: 6, padding: "14px 16px",
                fontSize: 13, color: LI.darkGray, lineHeight: 1.7,
                overflowX: "auto", overflowY: "auto", maxHeight: 400,
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "ui-monospace, 'Courier New', monospace",
                border: `1px solid ${LI.lightSilver}`,
              }}>{app.resume_text}</pre>
            </div>
          ) : (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "32px 20px", textAlign: "center", color: LI.slate, fontSize: 14 }}>
              No resume submitted for this application.
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

/* ── Main recruiter page ── */
export default function RecruiterReviewPage() {
  const [inputJobId, setInputJobId] = useState("");
  const [jobId, setJobId]           = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  async function handleSearch(e) {
    e.preventDefault();
    if (!inputJobId.trim()) return;
    setLoading(true); setError(""); setApplications([]); setSelectedId(null);
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

  const filtered = filterStatus === "all" ? applications : applications.filter(a => a.status === filterStatus);
  const counts = STATUSES.reduce((acc, s) => { acc[s] = applications.filter(a => a.status === s).length; return acc; }, {});

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: LI.bgMain, minHeight: "100vh", padding: "24px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}>

          {/* Page title */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: LI.black, margin: "0 0 4px" }}>Recruiter — Applicant Review</h1>
            <p style={{ color: LI.slate, fontSize: 14, margin: 0 }}>Enter a Job ID to load all applications, then select a candidate to review.</p>
          </div>

          {/* Search card */}
          <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "18px 22px", marginBottom: 20 }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: LI.darkGray, marginBottom: 5 }}>Job ID</label>
                <input value={inputJobId} onChange={e => setInputJobId(e.target.value)}
                  placeholder="e.g. job-001" style={inp} />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: "10px 24px", borderRadius: 24, border: "none",
                background: loading ? LI.lightSilver : LI.blue,
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8, height: 42,
              }}>
                {loading ? <><Spinner /> Loading…</> : "Load Applicants"}
              </button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: LI.redBg, border: `1px solid #f5c6bc`, borderRadius: 8, padding: "12px 16px", color: LI.red, fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Results */}
          {applications.length > 0 && (
            <>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {STATUSES.map(s => {
                  const m = STATUS_META[s];
                  return (
                    <div key={s} style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{counts[s]}</div>
                      <div style={{ fontSize: 12, color: LI.slate, marginTop: 2 }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Filter tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${LI.lightSilver}`, marginBottom: 16, background: LI.bgCard, borderRadius: "8px 8px 0 0", border: `1px solid ${LI.lightSilver}`, borderBottomWidth: 0 }}>
                {[{ id: "all", label: `All (${applications.length})` },
                  ...STATUSES.map(s => ({ id: s, label: `${STATUS_META[s].label} (${counts[s]})` }))
                ].map(t => (
                  <button key={t.id} onClick={() => setFilterStatus(t.id)} style={{
                    padding: "10px 16px", border: "none",
                    borderBottom: filterStatus === t.id ? `2px solid ${LI.blue}` : "2px solid transparent",
                    background: "transparent",
                    color: filterStatus === t.id ? LI.blue : LI.slate,
                    fontSize: 13, fontWeight: filterStatus === t.id ? 700 : 400,
                    cursor: "pointer",
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Two-column layout */}
              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

                {/* Left list */}
                <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", background: LI.bgMain, borderBottom: `1px solid ${LI.lightSilver}`, fontSize: 12, fontWeight: 600, color: LI.slate, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {filtered.length} Applicant{filtered.length !== 1 ? "s" : ""}
                  </div>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center", color: LI.slate, fontSize: 13 }}>
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

                {/* Right detail */}
                <div>
                  {selectedId ? (
                    <AppDetail key={selectedId} appId={selectedId} onStatusChanged={handleStatusChanged} />
                  ) : (
                    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "48px 32px", textAlign: "center", color: LI.slate }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>Select a candidate</div>
                      <div style={{ fontSize: 13 }}>Click an applicant on the left to view their full application</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && jobId && applications.length === 0 && !error && (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "48px 32px", textAlign: "center", color: LI.slate }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>No applications found</div>
              <div style={{ fontSize: 13 }}>No one has applied to job <strong>{jobId}</strong> yet.</div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}