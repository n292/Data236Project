import { useNavigate } from "react-router-dom";
import { CURRENT_MEMBER, DEMO_JOBS } from "../data/demoJobs";

const LI = {
  blue: "#0A66C2",
  darkBlue: "#004182",
  bgMain: "#F3F2EF",
  bgCard: "#FFFFFF",
  black: "#000000",
  darkGray: "#38434F",
  slate: "#56687A",
  lightSilver: "#CACCCE",
  bgBlueTint: "#DCE6F1",
};

export default function JobsPage() {
  const navigate = useNavigate();

  function handleApply(job) {
    navigate(`/applications/apply?jobId=${encodeURIComponent(job.job_id)}`, {
      state: { job },
    });
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: LI.bgCard,
          border: `1px solid ${LI.lightSilver}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, color: LI.black }}>Jobs available to apply</h1>
            <p style={{ margin: "8px 0 0", color: LI.slate, fontSize: 15 }}>
              Choose a job, open the application page, and the system will auto-fill the job, member,
              and recruiter IDs behind the scenes.
            </p>
          </div>
          <div
            style={{
              minWidth: 250,
              background: LI.bgBlueTint,
              borderRadius: 10,
              padding: 16,
              border: `1px solid ${LI.lightSilver}`,
            }}
          >
            <div style={{ fontSize: 12, color: LI.slate, textTransform: "uppercase", fontWeight: 700 }}>
              Demo signed-in member
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: LI.darkBlue, marginTop: 6 }}>
              {CURRENT_MEMBER.name}
            </div>
            <div style={{ fontSize: 13, color: LI.darkGray, marginTop: 4 }}>{CURRENT_MEMBER.headline}</div>
            <div style={{ fontSize: 13, color: LI.slate, marginTop: 4 }}>Member ID: {CURRENT_MEMBER.member_id}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        {DEMO_JOBS.map((job) => (
          <article
            key={job.job_id}
            style={{
              background: LI.bgCard,
              border: `1px solid ${LI.lightSilver}`,
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: LI.slate, fontWeight: 700, textTransform: "uppercase" }}>
                {job.employment_type} • {job.workplace_type}
              </div>
              <h2 style={{ margin: "8px 0 4px", fontSize: 22, color: LI.black }}>{job.title}</h2>
              <div style={{ color: LI.darkGray, fontWeight: 600 }}>{job.company}</div>
              <div style={{ color: LI.slate, fontSize: 14, marginTop: 4 }}>{job.location}</div>
            </div>

            <div style={{ color: LI.darkGray, lineHeight: 1.6, fontSize: 14 }}>{job.description}</div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: LI.black, marginBottom: 8 }}>Quick details</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: LI.darkGray, lineHeight: 1.7, fontSize: 14 }}>
                {job.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                background: LI.bgMain,
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
                color: LI.darkGray,
                lineHeight: 1.8,
              }}
            >
              <div><strong>Job ID:</strong> {job.job_id}</div>
              <div><strong>Recruiter ID:</strong> {job.recruiter_id}</div>
            </div>

            <button
              onClick={() => handleApply(job)}
              style={{
                marginTop: "auto",
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
              Apply now
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}