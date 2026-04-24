import { useState, useEffect, useCallback } from "react";
import {
  getApplicationsByJob,
  getApplication,
  updateApplicationStatus,
  addRecruiterNote,
} from "../api/applicationApi";

/* ─── LinkedIn colour tokens (from LinkedIn_Color_Palette.pdf) ─── */
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
  greenSuccess: "#44712E",
  greenBg: "#D7EBCE",
  msgGreen: "#057642",
  amber: "#E7A33E",
  amberBg: "#FCE2BA",
  red: "#B24020",
  coral: "#F5987E",
  redBg: "#FADFD8",
};

const STATUSES = ["submitted", "reviewed", "accepted", "rejected"];

const STATUS_META = {
  submitted: { bg: LI.bgBlueTint, text: LI.darkBlue, label: "Submitted" },
  reviewed: { bg: LI.amberBg, text: "#915907", label: "Reviewed" },
  accepted: { bg: LI.greenBg, text: LI.greenSuccess, label: "Accepted" },
  rejected: { bg: LI.redBg, text: LI.red, label: "Rejected" },
};

/* ─── Helpers ─── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.submitted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 24,
        background: m.bg,
        color: m.text,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}

function Avatar({ name, size = 40 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: LI.bgBlueTint,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: LI.darkBlue,
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        border: `3px solid ${LI.lightSilver}`,
        borderTop: `3px solid ${LI.blue}`,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
      }}
    />
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Applicant List Item ─── */
function ApplicantRow({ app, isSelected, onClick }) {
  const name = app.member_id;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        cursor: "pointer",
        background: isSelected ? LI.bgBlueTint : LI.bgCard,
        borderBottom: `1px solid ${LI.lightSilver}`,
        transition: "background 0.12s",
        borderLeft: isSelected ? `3px solid ${LI.blue}` : "3px solid transparent",
      }}
    >
      <Avatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: LI.black,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: LI.slate, marginTop: 2 }}>
          Applied {formatDate(app.created_at)}
        </div>
      </div>
      <StatusBadge status={app.status} />
    </div>
  );
}

/* ─── Status Update Panel ─── */
function StatusPanel({ app, onStatusUpdate, onNoteAdd, updatingStatus, addingNote }) {
  const [selectedStatus, setSelectedStatus] = useState(app.status);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    setSelectedStatus(app.status);
    setNote("");
    setNoteSaved(false);
  }, [app.application_id, app.status]);

  async function handleStatusChange() {
    if (selectedStatus === app.status) return;
    await onStatusUpdate(app.application_id, selectedStatus);
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    await onNoteAdd(app.application_id, note.trim());
    setNote("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 3000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Status changer */}
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: LI.black,
            margin: "0 0 14px",
          }}
        >
          Update Application Status
        </h3>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {STATUSES.map((s) => {
            const m = STATUS_META[s];
            const active = selectedStatus === s;
            return (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 24,
                  border: active
                    ? `2px solid ${LI.blue}`
                    : `1.5px solid ${LI.lightSilver}`,
                  background: active ? m.bg : LI.bgCard,
                  color: active ? m.text : LI.slate,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleStatusChange}
          disabled={updatingStatus || selectedStatus === app.status}
          style={{
            padding: "9px 24px",
            borderRadius: 24,
            border: "none",
            background:
              selectedStatus === app.status || updatingStatus
                ? LI.lightSilver
                : LI.blue,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor:
              selectedStatus === app.status || updatingStatus
                ? "not-allowed"
                : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {updatingStatus ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            "Save Status"
          )}
        </button>
      </div>

      {/* Recruiter notes */}
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: LI.black,
            margin: "0 0 6px",
          }}
        >
          Recruiter Notes
        </h3>

        {/* Existing note */}
        {app.recruiter_note && (
          <div
            style={{
              background: LI.bgMain,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 13,
              color: LI.darkGray,
              lineHeight: 1.6,
              border: `1px solid ${LI.lightSilver}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: LI.slate,
                fontWeight: 600,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Saved Note
            </div>
            {app.recruiter_note}
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this candidate…"
          style={{
            width: "100%",
            minHeight: 90,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${LI.lightSilver}`,
            fontSize: 13,
            color: LI.darkGray,
            resize: "vertical",
            fontFamily: "inherit",
            background: LI.bgCard,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
          }}
        >
          <button
            onClick={handleAddNote}
            disabled={addingNote || !note.trim()}
            style={{
              padding: "9px 22px",
              borderRadius: 24,
              border: "none",
              background:
                addingNote || !note.trim() ? LI.lightSilver : LI.blue,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor:
                addingNote || !note.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {addingNote ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              "Add Note"
            )}
          </button>

          {noteSaved && (
            <span
              style={{
                fontSize: 13,
                color: LI.msgGreen,
                fontWeight: 600,
              }}
            >
              ✓ Note saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Resume Panel ─── */
function ResumePanel({ app }) {
  if (!app.resume_text) {
    return (
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 8,
          padding: "32px 24px",
          textAlign: "center",
          color: LI.slate,
          fontSize: 14,
        }}
      >
        No resume submitted for this application.
      </div>
    );
  }

  return (
    <div
      style={{
        background: LI.bgCard,
        border: `1px solid ${LI.lightSilver}`,
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: LI.black,
            margin: 0,
          }}
        >
          Resume
        </h3>
        <span style={{ fontSize: 12, color: LI.slate }}>
          {app.resume_text.length.toLocaleString()} characters
        </span>
      </div>

      <pre
        style={{
          background: LI.bgMain,
          borderRadius: 6,
          padding: "16px 18px",
          fontSize: 13,
          color: LI.darkGray,
          lineHeight: 1.7,
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: 420,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "ui-monospace, 'Courier New', monospace",
          border: `1px solid ${LI.lightSilver}`,
        }}
      >
        {app.resume_text}
      </pre>
    </div>
  );
}

/* ─── Application Detail View ─── */
function ApplicationDetail({ appId, onStatusChanged }) {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getApplication(appId);
      setApp(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusUpdate(application_id, status) {
    setUpdatingStatus(true);
    try {
      const result = await updateApplicationStatus(application_id, status);
      setApp(result.application);
      showSuccess(`Status updated to "${STATUS_META[status]?.label}"`);
      onStatusChanged?.(application_id, status);
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleNoteAdd(application_id, recruiter_note) {
    setAddingNote(true);
    try {
      const result = await addRecruiterNote(application_id, recruiter_note);
      setApp(result.application);
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingNote(false);
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: LI.slate,
          gap: 12,
        }}
      >
        <Spinner /> Loading application…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: LI.redBg,
          border: `1px solid #f5c6bc`,
          borderRadius: 8,
          padding: "16px 20px",
          color: LI.red,
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  if (!app) return null;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "resume", label: "Resume" },
    { id: "actions", label: "Actions" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Candidate header */}
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: "8px 8px 0 0",
          padding: "20px 24px",
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          borderBottom: "none",
        }}
      >
        <Avatar name={app.member_id} size={52} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: LI.black,
              marginBottom: 4,
            }}
          >
            Candidate: {app.member_id}
          </div>
          <div style={{ fontSize: 13, color: LI.slate, marginBottom: 10 }}>
            Applied {formatDate(app.created_at)} · Job: {app.job_id}
          </div>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div
          style={{
            background: LI.greenBg,
            padding: "10px 24px",
            fontSize: 13,
            color: LI.greenSuccess,
            fontWeight: 600,
          }}
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: `2px solid ${LI.lightSilver}`,
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderTop: "none",
          borderBottom: "none",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? `3px solid ${LI.blue}`
                  : "3px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? LI.blue : LI.slate,
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        style={{
          background: LI.bgMain,
          border: `1px solid ${LI.lightSilver}`,
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          padding: "20px 24px",
        }}
      >
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Info grid */}
            <div
              style={{
                background: LI.bgCard,
                border: `1px solid ${LI.lightSilver}`,
                borderRadius: 8,
                padding: "18px 22px",
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: LI.black,
                  margin: "0 0 14px",
                }}
              >
                Application Details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                {[
                  ["Application ID", app.application_id],
                  ["Job ID", app.job_id],
                  ["Member ID", app.member_id],
                  ["Recruiter ID", app.recruiter_id || "—"],
                  ["Status", <StatusBadge key="s" status={app.status} />],
                  ["Applied On", formatDate(app.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: 11,
                        color: LI.slate,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: LI.darkGray,
                        fontFamily:
                          label === "Application ID" ? "monospace" : "inherit",
                        fontSize: label === "Application ID" ? 12 : 14,
                        wordBreak: "break-all",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover letter */}
            {app.cover_letter && (
              <div
                style={{
                  background: LI.bgCard,
                  border: `1px solid ${LI.lightSilver}`,
                  borderRadius: 8,
                  padding: "18px 22px",
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: LI.black,
                    margin: "0 0 10px",
                  }}
                >
                  Cover Letter
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: LI.darkGray,
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {app.cover_letter}
                </p>
              </div>
            )}

            {/* Recruiter note preview */}
            {app.recruiter_note && (
              <div
                style={{
                  background: LI.amberBg,
                  border: `1px solid ${LI.amber}`,
                  borderRadius: 8,
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#915907",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  Recruiter Note
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#5c3a00",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {app.recruiter_note}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "resume" && <ResumePanel app={app} />}

        {activeTab === "actions" && (
          <StatusPanel
            app={app}
            onStatusUpdate={handleStatusUpdate}
            onNoteAdd={handleNoteAdd}
            updatingStatus={updatingStatus}
            addingNote={addingNote}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Main Recruiter Review Page ─── */
export default function RecruiterReviewPage() {
  const [jobId, setJobId] = useState("");
  const [inputJobId, setInputJobId] = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  async function handleSearch(e) {
    e.preventDefault();
    if (!inputJobId.trim()) return;
    setLoading(true);
    setError("");
    setApplications([]);
    setSelectedAppId(null);
    try {
      const data = await getApplicationsByJob(inputJobId.trim());
      setApplications(Array.isArray(data) ? data : []);
      setJobId(inputJobId.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChanged(appId, newStatus) {
    setApplications((prev) =>
      prev.map((a) =>
        a.application_id === appId ? { ...a, status: newStatus } : a
      )
    );
  }

  const filtered =
    filterStatus === "all"
      ? applications
      : applications.filter((a) => a.status === filterStatus);

  /* Status summary counts */
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ padding: "24px 0" }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: LI.black,
              margin: "0 0 6px",
            }}
          >
            Recruiter — Applicant Review
          </h1>
          <p style={{ color: LI.slate, fontSize: 14, margin: 0 }}>
            Enter a Job ID to load all applications, then select a candidate to
            review their resume, update status, or add notes.
          </p>
        </div>

        {/* Job ID search */}
        <form
          onSubmit={handleSearch}
          style={{
            background: LI.bgCard,
            border: `1px solid ${LI.lightSilver}`,
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: LI.darkGray,
                marginBottom: 6,
              }}
            >
              Job ID
            </label>
            <input
              value={inputJobId}
              onChange={(e) => setInputJobId(e.target.value)}
              placeholder="e.g. job-001"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${LI.lightSilver}`,
                fontSize: 14,
                color: LI.darkGray,
                background: LI.bgCard,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 28px",
              borderRadius: 24,
              border: "none",
              background: loading ? LI.slate : LI.blue,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 42,
            }}
          >
            {loading ? <><Spinner /> Loading…</> : "Load Applicants"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div
            style={{
              background: LI.redBg,
              border: `1px solid #f5c6bc`,
              borderRadius: 8,
              padding: "12px 16px",
              color: LI.red,
              fontSize: 14,
              marginBottom: 20,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {applications.length > 0 && (
          <>
            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {STATUSES.map((s) => {
                const m = STATUS_META[s];
                return (
                  <div
                    key={s}
                    style={{
                      background: LI.bgCard,
                      border: `1px solid ${LI.lightSilver}`,
                      borderRadius: 8,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: m.text,
                      }}
                    >
                      {counts[s]}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: LI.slate,
                        marginTop: 2,
                      }}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                borderBottom: `2px solid ${LI.lightSilver}`,
                paddingBottom: 0,
              }}
            >
              {[
                { id: "all", label: `All (${applications.length})` },
                ...STATUSES.map((s) => ({
                  id: s,
                  label: `${STATUS_META[s].label} (${counts[s]})`,
                })),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    padding: "8px 14px",
                    border: "none",
                    borderBottom:
                      filterStatus === tab.id
                        ? `3px solid ${LI.blue}`
                        : "3px solid transparent",
                    background: "transparent",
                    color: filterStatus === tab.id ? LI.blue : LI.slate,
                    fontSize: 13,
                    fontWeight: filterStatus === tab.id ? 700 : 400,
                    cursor: "pointer",
                    marginBottom: -2,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Two-column layout: list + detail */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "300px 1fr",
                gap: 16,
                alignItems: "start",
              }}
            >
              {/* Left: applicant list */}
              <div
                style={{
                  border: `1px solid ${LI.lightSilver}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: LI.bgCard,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: LI.bgMain,
                    borderBottom: `1px solid ${LI.lightSilver}`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: LI.slate,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {filtered.length} Applicant{filtered.length !== 1 ? "s" : ""}
                </div>
                {filtered.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: LI.slate,
                      fontSize: 13,
                    }}
                  >
                    No applicants with this status
                  </div>
                ) : (
                  filtered.map((app) => (
                    <ApplicantRow
                      key={app.application_id}
                      app={app}
                      isSelected={selectedAppId === app.application_id}
                      onClick={() => setSelectedAppId(app.application_id)}
                    />
                  ))
                )}
              </div>

              {/* Right: detail panel */}
              <div>
                {selectedAppId ? (
                  <ApplicationDetail
                    key={selectedAppId}
                    appId={selectedAppId}
                    onStatusChanged={handleStatusChanged}
                  />
                ) : (
                  <div
                    style={{
                      background: LI.bgCard,
                      border: `1px solid ${LI.lightSilver}`,
                      borderRadius: 8,
                      padding: "48px 32px",
                      textAlign: "center",
                      color: LI.slate,
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: LI.darkGray }}>
                      Select a candidate
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Click an applicant on the left to review their application
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state after search */}
        {!loading && jobId && applications.length === 0 && !error && (
          <div
            style={{
              background: LI.bgCard,
              border: `1px solid ${LI.lightSilver}`,
              borderRadius: 8,
              padding: "48px 32px",
              textAlign: "center",
              color: LI.slate,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 6,
                color: LI.darkGray,
              }}
            >
              No applications found
            </div>
            <div style={{ fontSize: 13 }}>
              No applications have been submitted for job <strong>{jobId}</strong>
            </div>
          </div>
        )}
      </div>
    </>
  );
}