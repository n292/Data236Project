import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function ApplyPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const id = jobId || searchParams.get("jobId");
    if (id) {
      // Redirect to jobs page with parameters that trigger the modal
      navigate(`/jobs?apply=true&jobId=${id}`, { replace: true });
    } else {
      navigate("/jobs", { replace: true });
    }
  }, [jobId, searchParams, navigate]);

  return (
    <div className="li-dashboard" style={{ maxWidth: 480, margin: '0 auto', padding: '80px 16px' }}>
      <div className="li-card" style={{ textAlign: 'center' }}>
        <p className="li-card__desc" style={{ marginBottom: 0 }}>Redirecting to Easy Apply…</p>
      </div>
    </div>
  );
}