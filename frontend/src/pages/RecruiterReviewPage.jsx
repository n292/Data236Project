import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApplicationsByJob, getApplication, updateApplicationStatus, addRecruiterNote } from "../api/applicationApi";
import {
  createShortlistTask, getShortlistTask, getShortlistResults,
  approveShortlist, approveCandidate, editAndApprove, rejectShortlist, rejectCandidate, streamAiTask,
} from "../api/aiApi";
import { searchMembers, getMember } from "../api/memberApi";

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
function ApplicantRow({ app, isSelected, onClick, memberMap = {} }) {
  const member = memberMap[app.member_id];
  const displayName = member ? `${member.first_name} ${member.last_name}`.trim() : app.member_id;
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 16px", cursor: "pointer",
      background: isSelected ? LI.bgBlueTint : LI.bgCard,
      borderBottom: `1px solid ${LI.lightSilver}`,
      borderLeft: `3px solid ${isSelected ? LI.blue : "transparent"}`,
      transition: "all 0.12s",
    }}>
      {member?.profile_photo_url ? (
        <img src={member.profile_photo_url} alt={displayName} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${LI.lightSilver}` }} />
      ) : (
        <Avatar name={displayName} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: LI.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName}
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
function AppDetail({ appId, onStatusChanged, memberMap = {} }) {
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
      {(() => {
        const member = memberMap[app.member_id];
        const displayName = member ? `${member.first_name} ${member.last_name}`.trim() : app.member_id;
        return (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LI.lightSilver}`, background: LI.bgCard, display: "flex", alignItems: "flex-start", gap: 14 }}>
            {member?.profile_photo_url ? (
              <img src={member.profile_photo_url} alt={displayName} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${LI.lightSilver}` }} />
            ) : (
              <Avatar name={displayName} size={56} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: LI.black, marginBottom: 2 }}>
                {displayName}
              </div>
              {member?.headline && (
                <div style={{ fontSize: 13, color: LI.slate, marginBottom: 4 }}>{member.headline}</div>
              )}
              <div style={{ fontSize: 13, color: LI.slate, marginBottom: 10 }}>
                Applied {formatDate(app.created_at)} · Job: <strong style={{ color: LI.darkGray }}>{app.job_id}</strong>
              </div>
              <StatusBadge status={app.status} large />
            </div>
          </div>
        );
      })()}

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
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: LI.darkGray }}>
              {app.resume_text}
            </div>
          ) : (app.resume_file_name || app.resume_url) ? (() => {
            // Build a clean filename and URL
            const rawUrl = app.resume_url || '';
            const fileName = app.resume_file_name || rawUrl.split('/').pop() || 'resume.pdf';
            // Prefer nginx proxy path; fall back to absolute URL if already http
            const downloadHref = rawUrl.startsWith('http')
              ? rawUrl
              : `/uploads/${rawUrl.replace(/^uploads\//, '')}`;
            return (
              <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "32px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                <div style={{ fontWeight: 600, color: LI.darkGray, marginBottom: 8 }}>{fileName}</div>
                <a
                  href={downloadHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: LI.blue, fontWeight: 700, fontSize: 14 }}
                >
                  Download / View Resume PDF
                </a>
              </div>
            );
          })() : (
            <div style={{ textAlign: "center", color: LI.slate, padding: "32px 0" }}>
              No resume submitted
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
   AI Shortlist Panel  (full pipeline version)
══════════════════════════════════════════════ */

const STEP_LABELS = {
  requested:                    { icon: "🚀", label: "Task created"             },
  parsing_resumes:              { icon: "📄", label: "Fetching & parsing resumes" },
  scoring_candidates:           { icon: "🏆", label: "Scoring candidates"        },
  generating_explanations:      { icon: "🧠", label: "Generating explanations"   },
  generating_outreach:          { icon: "✉️",  label: "Drafting outreach"         },
  awaiting_recruiter_approval:  { icon: "👤", label: "Awaiting your review"      },
  human_approval:               { icon: "✅", label: "Review recorded"           },
  completed:                    { icon: "✅", label: "Complete"                  },
  failed:                       { icon: "❌", label: "Failed"                    },
};

const TERMINAL = new Set(["awaiting_recruiter_approval", "completed", "failed"]);

function ScoreBar({ score }) {
  const color = score >= 80 ? LI.green : score >= 60 ? LI.amber : LI.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#F3F2EF", borderRadius: 4 }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36 }}>{score}</span>
    </div>
  );
}

function ScoreBreakdown({ bd }) {
  const rows = [
    ["Skills",      bd.skills_score,     40],
    ["Seniority",   bd.seniority_score,  20],
    ["Experience",  bd.experience_score, 15],
    ["Location",    bd.location_score,   15],
    ["Domain Fit",  bd.bonus_score,      10],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 8 }}>
      {rows.map(([label, val, max]) => (
        <div key={label} style={{ background: LI.bgMain, borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: LI.blue }}>{val ?? "—"}<span style={{ fontSize: 10, color: LI.slate }}>/{max}</span></div>
          <div style={{ fontSize: 10, color: LI.slate, marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function FitBadge({ label }) {
  const colors = {
    strong_fit:        [LI.greenBg, LI.greenText],
    good_fit:          [LI.bgBlueTint, LI.darkBlue],
    partial_fit:       [LI.amberBg, "#915907"],
    weak_fit:          [LI.redBg, LI.red],
    remote_eligible:   [LI.greenBg, LI.greenText],
    same_city:         [LI.greenBg, LI.greenText],
    same_state:        [LI.bgBlueTint, LI.darkBlue],
    remote_possible:   [LI.bgBlueTint, LI.darkBlue],
    unknown:           ["#f0f0f0", LI.slate],
    different_location:["#f5e6e6", LI.red],
  };
  const [bg, fg] = colors[label] || ["#f0f0f0", LI.slate];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: bg, color: fg, borderRadius: 4, padding: "2px 8px" }}>
      {(label || "—").replace(/_/g, " ")}
    </span>
  );
}

function CandidateCard({ c, rank, taskId, onUpdated }) {
  const [expanded, setExpanded]   = useState(rank === 1);
  const [editing, setEditing]     = useState(false);
  const [editedMsg, setEditedMsg] = useState("");
  const [editedSubj, setEditedSubj] = useState("");
  const [saving, setSaving]       = useState(false);
  const [localStatus, setLocalStatus] = useState(c.approval_status || "pending");

  const draft = c.edited_outreach || c.outreach_draft;
  const expl  = c.candidate_explanation;
  const score = Math.round(c.match_score || 0);
  const name  = c.candidate_name || c.candidate_id;

  async function handleApprove() {
    setSaving(true);
    try {
      await approveCandidate(taskId, c.candidate_id);
      setLocalStatus("approved");
      onUpdated?.();
    } catch (e) { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleEditApprove() {
    setSaving(true);
    try {
      await editAndApprove(taskId, {
        candidate_id: c.candidate_id,
        edited_subject: editedSubj || draft?.subject,
        edited_message: editedMsg,
      });
      setLocalStatus("edited_approved");
      setEditing(false);
      onUpdated?.();
    } catch (e) { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleReject() {
    setSaving(true);
    try {
      await rejectCandidate(taskId, c.candidate_id);
      setLocalStatus("rejected");
      onUpdated?.();
    } catch (e) { /* silent */ }
    finally { setSaving(false); }
  }

  const approvalColors = {
    pending:        [LI.amberBg, "#915907"],
    approved:       [LI.greenBg, LI.greenText],
    edited_approved:[LI.greenBg, LI.greenText],
    rejected:       [LI.redBg, LI.red],
  };
  const [apBg, apFg] = approvalColors[localStatus] || approvalColors.pending;

  return (
    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(x => !x)}
        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, background: LI.bgBlueTint, color: LI.blue, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>#{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: LI.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 11, color: LI.slate, marginTop: 1 }}>
            {c.inferred_seniority} · {c.experience_years != null ? `${c.experience_years}y exp` : "exp unknown"}
          </div>
        </div>
        <div style={{ width: 120, flexShrink: 0 }}><ScoreBar score={score} /></div>
        <span style={{ fontSize: 11, fontWeight: 600, background: apBg, color: apFg, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
          {localStatus.replace(/_/g, " ")}
        </span>
        <span style={{ color: LI.slate, fontSize: 14 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${LI.lightSilver}`, padding: "14px 16px", background: LI.bgMain, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Skills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.matched_skills?.map(s => (
              <span key={s} style={{ fontSize: 11, background: LI.greenBg, color: LI.greenText, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>✓ {s}</span>
            ))}
            {c.missing_skills?.slice(0, 5).map(s => (
              <span key={s} style={{ fontSize: 11, background: LI.redBg, color: LI.red, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>✗ {s}</span>
            ))}
          </div>

          {/* Fit badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FitBadge label={c.seniority_fit} />
            <FitBadge label={c.location_fit} />
          </div>

          {/* Score breakdown */}
          {c.score_breakdown && <ScoreBreakdown bd={c.score_breakdown} />}

          {/* AI Explanation */}
          {expl && (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LI.slate, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>🧠 Why Recommended</div>
              <p style={{ fontSize: 13, color: LI.darkGray, margin: "0 0 8px", lineHeight: 1.6 }}>{expl.summary}</p>
              {expl.reasons?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {expl.reasons.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, color: LI.slate, lineHeight: 1.6 }}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Outreach draft */}
          {draft && !editing && (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LI.slate, textTransform: "uppercase", letterSpacing: 0.5 }}>✉️ Outreach Draft</div>
                {localStatus === "pending" && (
                  <button onClick={() => { setEditedMsg(draft.full_message); setEditedSubj(draft.subject); setEditing(true); }}
                    style={{ fontSize: 12, color: LI.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Edit
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: LI.slate, marginBottom: 4 }}>
                <strong>Subject:</strong> {draft.subject}
              </div>
              <p style={{ fontSize: 13, color: LI.darkGray, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{draft.full_message}</p>
            </div>
          )}

          {/* Edit outreach */}
          {editing && (
            <div style={{ background: LI.bgCard, border: `1px solid ${LI.blue}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: LI.blue, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>✏️ Edit Outreach Draft</div>
              <input
                value={editedSubj}
                onChange={e => setEditedSubj(e.target.value)}
                placeholder="Subject line…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${LI.lightSilver}`, fontSize: 13, marginBottom: 8, boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <textarea
                value={editedMsg}
                onChange={e => setEditedMsg(e.target.value)}
                rows={6}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${LI.lightSilver}`, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={handleEditApprove} disabled={saving} style={{ padding: "7px 18px", borderRadius: 24, border: "none", background: LI.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? <Spinner /> : "Save & Approve"}
                </button>
                <button onClick={() => setEditing(false)} style={{ padding: "7px 18px", borderRadius: 24, border: `1px solid ${LI.lightSilver}`, background: LI.bgCard, color: LI.slate, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Approval actions */}
          {localStatus === "pending" && !editing && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleApprove} disabled={saving} style={{ padding: "8px 20px", borderRadius: 24, border: "none", background: LI.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {saving ? <Spinner /> : "✓ Approve"}
              </button>
              <button onClick={() => { setEditedMsg(draft?.full_message || ""); setEditedSubj(draft?.subject || ""); setEditing(true); }} style={{ padding: "8px 20px", borderRadius: 24, border: `1px solid ${LI.blue}`, background: "transparent", color: LI.blue, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ✏️ Edit & Approve
              </button>
              <button onClick={handleReject} disabled={saving} style={{ padding: "8px 20px", borderRadius: 24, border: `1px solid ${LI.red}`, background: "transparent", color: LI.red, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                ✕ Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiShortlistPanel({ jobId }) {
  const { user } = useAuth();
  const recruiterId = user?.member_id || "";

  const [open, setOpen]       = useState(false);
  const [status, setStatus]   = useState("idle");
  const [steps, setSteps]     = useState([]);
  const [results, setResults] = useState(null);
  const [taskId, setTaskId]   = useState(null);
  const [topN, setTopN]       = useState(5);
  const [msg, setMsg]         = useState("");
  const pollRef = useRef(null);
  const esRef   = useRef(null);

  const STORAGE_KEY = `ai_task_${jobId}`;

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  function stopSSE() {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
  }
  useEffect(() => () => { stopPoll(); stopSSE(); }, []);

  async function loadResults(tid) {
    try {
      const r = await getShortlistResults(tid);
      setResults(r);
    } catch (e) {
      setMsg(`Could not load results: ${e.message}`);
    }
  }

  function startPolling(pollTid) {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const r = await getShortlistTask(pollTid);
        const s = r.task?.status || "failed";
        setSteps(r.task?.steps || []);
        if (TERMINAL.has(s)) {
          setStatus(s);
          stopPoll();
          await loadResults(pollTid);
        }
      } catch {
        stopPoll();
        setStatus("failed");
        try { await loadResults(pollTid); } catch { /* silent */ }
      }
    }, 2000);
  }

  function connectSSE(tid) {
    stopSSE();
    const es = streamAiTask(tid);
    esRef.current = es;
    es.addEventListener("step", e => {
      const d = JSON.parse(e.data);
      setSteps(prev => [...prev, d]);
    });
    es.addEventListener("done", async e => {
      const d = JSON.parse(e.data);
      setStatus(d.status);
      stopSSE();
      await loadResults(tid);
    });
    es.addEventListener("timeout", () => {
      stopSSE();
      startPolling(tid);
    });
    es.addEventListener("error", () => {
      if (es.readyState === EventSource.CLOSED) return;
      stopSSE();
      startPolling(tid);
    });
  }

  // On mount: reconnect to any in-progress task for this job
  useEffect(() => {
    if (!jobId) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    (async () => {
      try {
        const r = await getShortlistTask(saved);
        const task = r.task;
        if (!task) { localStorage.removeItem(STORAGE_KEY); return; }
        const s = task.status || "failed";
        setTaskId(saved);
        setSteps(task.steps || []);
        if (TERMINAL.has(s)) {
          setStatus(s);
          await loadResults(saved);
        } else {
          setStatus("running");
          setOpen(true);
          connectSSE(saved);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [jobId]);

  async function runShortlist() {
    if (!jobId) return;
    setStatus("running"); setSteps([]); setResults(null); setMsg("");
    stopPoll(); stopSSE();

    let tid;
    try {
      const r = await createShortlistTask({ job_id: jobId, recruiter_id: recruiterId, top_n: topN, include_outreach: true });
      tid = r.task_id;
      setTaskId(tid);
      localStorage.setItem(STORAGE_KEY, tid);
    } catch (e) {
      setStatus("failed");
      setMsg(`Error: ${e.message}`);
      return;
    }

    connectSSE(tid);
  }

  const shortlist = results?.shortlist || [];
  const metrics   = results?.metrics || {};

  return (
    <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>

      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: LI.black }}>AI Shortlist</div>
            <div style={{ fontSize: 12, color: LI.slate }}>Supervisor agent: resume parsing → ranking → outreach draft → human approval</div>
          </div>
        </div>
        <span style={{ color: LI.blue, fontSize: 18 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${LI.lightSilver}`, padding: "20px 24px", background: LI.bgMain }}>

          {/* Controls */}
          {status === "idle" && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
              <div>
                <label style={{ fontSize: 12, color: LI.slate, marginRight: 6 }}>Top N:</label>
                <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${LI.lightSilver}`, fontSize: 13 }}>
                  {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={runShortlist} disabled={!jobId} style={{
                padding: "10px 24px", borderRadius: 24, border: "none",
                background: !jobId ? LI.lightSilver : LI.blue,
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: !jobId ? "not-allowed" : "pointer",
              }}>
                Run AI Shortlist
              </button>
              {!jobId && <span style={{ fontSize: 12, color: LI.slate }}>Load applicants first</span>}
            </div>
          )}

          {msg && <div style={{ fontSize: 13, color: LI.red, marginBottom: 12 }}>⚠ {msg}</div>}

          {/* Live step progress */}
          {steps.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: LI.darkGray, marginBottom: 8 }}>Workflow Progress</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map((s, i) => {
                  const meta = STEP_LABELS[s.step] || { icon: "•", label: s.step };
                  const done = ["completed", "ok", "approved", "fetched_applications", "started"].includes(s.status);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: LI.bgCard, borderRadius: 8, border: `1px solid ${LI.lightSilver}` }}>
                      <span style={{ fontSize: 15 }}>{meta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: done ? LI.green : LI.darkGray }}>{meta.label}</div>
                        {s.data && Object.keys(s.data).length > 0 && (
                          <div style={{ fontSize: 11, color: LI.slate, marginTop: 1 }}>
                            {Object.entries(s.data).slice(0, 4)
                              .filter(([, v]) => typeof v !== "object")
                              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: done ? LI.green : LI.slate }}>{s.status}</span>
                    </div>
                  );
                })}
                {status === "running" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", color: LI.slate, fontSize: 13 }}>
                    <Spinner /> Processing…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metrics row */}
          {Object.keys(metrics).length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                ["Evaluated", metrics.candidate_count],
                ["Shortlisted", metrics.shortlist_count],
                ["Top Score", metrics.top_score != null ? `${metrics.top_score}/100` : "—"],
                ["Avg Score", metrics.avg_score != null ? `${metrics.avg_score}/100` : "—"],
                ["Rate", metrics.shortlist_rate != null ? `${(metrics.shortlist_rate * 100).toFixed(0)}%` : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 8, padding: "10px 16px", minWidth: 90, textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: LI.blue }}>{val ?? "—"}</div>
                  <div style={{ fontSize: 11, color: LI.slate, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Shortlist cards */}
          {shortlist.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: LI.darkGray, marginBottom: 4 }}>
                Top {shortlist.length} Candidates
              </div>
              {shortlist.map((c, i) => (
                <CandidateCard
                  key={c.candidate_id || i}
                  c={c} rank={i + 1} taskId={taskId}
                  onUpdated={() => loadResults(taskId)}
                />
              ))}
            </div>
          )}

          {/* Re-run */}
          {(status === "completed" || status === "awaiting_recruiter_approval" || status === "failed") && (
            <button
              onClick={() => { localStorage.removeItem(STORAGE_KEY); setStatus("idle"); setSteps([]); setResults(null); setTaskId(null); setMsg(""); stopPoll(); stopSSE(); }}
              style={{ marginTop: 14, padding: "8px 18px", borderRadius: 24, border: `1px solid ${LI.lightSilver}`, background: LI.bgCard, color: LI.slate, fontSize: 13, cursor: "pointer" }}
            >
              Run Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   All-Members talent search panel
══════════════════════════════════════════════ */
function MemberSearchPanel() {
  const [keyword, setKeyword]   = useState("")
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError]       = useState("")

  async function handleSearch(e) {
    e.preventDefault()
    setLoading(true); setError(""); setSearched(true)
    try {
      const data = await searchMembers({ keyword, skill: "", location: "", limit: 50 })
      setMembers(data.members || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="Search by name, skill, headline…"
          style={{ ...inp, flex: 1 }}
          onFocus={e => e.target.style.borderColor = LI.blue}
          onBlur={e => e.target.style.borderColor = LI.lightSilver}
        />
        <button type="submit" disabled={loading} style={{
          padding: "10px 26px", borderRadius: 24, border: "none",
          background: loading ? LI.lightSilver : LI.blue,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 8, height: 42,
        }}>
          {loading ? <><Spinner /> Searching…</> : "Search"}
        </button>
      </form>

      {error && <div style={{ color: LI.red, fontSize: 14, marginBottom: 12 }}>⚠ {error}</div>}

      {searched && !loading && members.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: LI.slate }}>No members found.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {members.map(m => {
          const name = `${m.first_name} ${m.last_name}`.trim()
          const skills = Array.isArray(m.skills) ? m.skills
            : (typeof m.skills === "string" ? (() => { try { return JSON.parse(m.skills) } catch { return [] } })() : [])
          return (
            <div key={m.member_id} style={{
              background: LI.bgCard, border: `1px solid ${LI.lightSilver}`,
              borderRadius: 10, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: LI.bgBlueTint, color: LI.blue,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18, overflow: "hidden",
              }}>
                {m.profile_photo_url
                  ? <img src={m.profile_photo_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: LI.black }}>{name}</div>
                {m.headline && <div style={{ fontSize: 13, color: LI.slate, marginTop: 2 }}>{m.headline}</div>}
                <div style={{ fontSize: 11, color: LI.silver, marginTop: 2, fontFamily: "monospace" }}>{m.member_id}</div>
                {skills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {skills.slice(0, 5).map(s => (
                      <span key={s} style={{ fontSize: 11, background: LI.bgBlueTint, color: LI.blue, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link to={`/members/${m.member_id}`} style={{
                padding: "7px 18px", borderRadius: 24,
                border: `1px solid ${LI.blue}`, color: LI.blue,
                fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                View Profile
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main RecruiterReviewPage
══════════════════════════════════════════════ */
export default function RecruiterReviewPage() {
  const { user } = useAuth();
  const [tab, setTab]                   = useState("by_job");
  const [jobId, setJobId]               = useState("");
  const [applications, setApplications] = useState([]);
  const [memberMap, setMemberMap]       = useState({});
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [selectedId, setSelectedId]     = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Jobs dropdown state
  const [recruiterJobs, setRecruiterJobs] = useState([]);
  const [jobsLoading, setJobsLoading]     = useState(false);

  // Fetch recruiter's jobs for the dropdown
  useEffect(() => {
    const recruiterId = user?.member_id;
    if (!recruiterId) return;
    setJobsLoading(true);
    const token = localStorage.getItem("token");
    fetch("/api/v1/jobs/byRecruiter", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ recruiter_id: recruiterId, page: 1, limit: 100 }),
    })
      .then(r => r.json())
      .then(b => setRecruiterJobs(Array.isArray(b.jobs) ? b.jobs : []))
      .catch(() => {})
      .finally(() => setJobsLoading(false));
  }, [user?.member_id]);

  async function fetchMemberMap(apps) {
    const ids = [...new Set(apps.map(a => a.member_id))];
    const entries = await Promise.all(
      ids.map(id => getMember(id).then(res => [id, res?.member || res]).catch(() => [id, null]))
    );
    setMemberMap(Object.fromEntries(entries.filter(([, m]) => m !== null)));
  }

  async function loadApplicantsForJob(selectedJobId) {
    if (!selectedJobId) return;
    setLoading(true); setError(""); setApplications([]); setMemberMap({}); setSelectedId(null); setFilterStatus("all");
    try {
      const data = await getApplicationsByJob(selectedJobId);
      const apps = Array.isArray(data) ? data : [];
      setApplications(apps);
      setJobId(selectedJobId);
      if (apps.length > 0) fetchMemberMap(apps);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleJobSelect(e) {
    const selectedJobId = e.target.value;
    setJobId(selectedJobId);
    if (selectedJobId) loadApplicantsForJob(selectedJobId);
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
            Review applicants for a specific job, or search the full member pool for talent.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `2px solid ${LI.lightSilver}` }}>
          {[{ id: "by_job", label: "📋 By Job ID" }, { id: "all_members", label: "👥 All Members" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 24px", border: "none", background: "none",
              borderBottom: tab === t.id ? `2px solid ${LI.blue}` : "2px solid transparent",
              marginBottom: -2,
              color: tab === t.id ? LI.blue : LI.slate,
              fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
              cursor: "pointer", transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "all_members" && (
          <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <MemberSearchPanel />
          </div>
        )}

        {tab === "by_job" && <>

        {/* Job selector card */}
        <div style={{ background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>
            Select a Job
          </label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <select
                value={jobId}
                onChange={handleJobSelect}
                disabled={jobsLoading}
                style={{
                  ...inp,
                  appearance: "none",
                  paddingRight: 36,
                  cursor: jobsLoading ? "wait" : "pointer",
                  color: jobId ? LI.darkGray : LI.silver,
                  background: `${LI.bgCard} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2356687A' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center`,
                }}
              >
                <option value="">
                  {jobsLoading ? "Loading your jobs…" : recruiterJobs.length === 0 ? "No jobs found — post a job first" : "— Select a job to view applicants —"}
                </option>
                {/* Open jobs first */}
                {recruiterJobs.filter(j => j.status === "open").length > 0 && (
                  <optgroup label="Open Jobs">
                    {recruiterJobs
                      .filter(j => j.status === "open")
                      .map(j => (
                        <option key={j.job_id} value={j.job_id}>
                          {j.title} — {j.location || "No location"} · {j.applicants_count ?? 0} applicant{j.applicants_count !== 1 ? "s" : ""}
                        </option>
                      ))}
                  </optgroup>
                )}
                {/* Closed jobs */}
                {recruiterJobs.filter(j => j.status !== "open").length > 0 && (
                  <optgroup label="Closed Jobs">
                    {recruiterJobs
                      .filter(j => j.status !== "open")
                      .map(j => (
                        <option key={j.job_id} value={j.job_id}>
                          {j.title} — {j.location || "No location"} [Closed]
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: LI.slate, fontSize: 14, flexShrink: 0 }}>
                <Spinner /> Loading…
              </div>
            )}
          </div>
          {jobId && (
            <div style={{ marginTop: 8, fontSize: 12, color: LI.slate }}>
              Job ID: <span style={{ fontFamily: "monospace", color: LI.darkGray }}>{jobId}</span>
            </div>
          )}
        </div>

        {/* AI Shortlist Panel */}
        <AiShortlistPanel jobId={jobId} />

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
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
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
                      onClick={() => setSelectedId(app.application_id)}
                      memberMap={memberMap} />
                  ))
                )}
              </div>

              {/* Right detail panel */}
              <div>
                {selectedId ? (
                  <AppDetail key={selectedId} appId={selectedId} onStatusChanged={handleStatusChanged} memberMap={memberMap} />
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

        </>}

      </div>
    </div>
  );
}