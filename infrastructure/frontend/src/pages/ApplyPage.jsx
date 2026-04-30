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
    <div style={{ textAlign: 'center', padding: '100px 20px', color: '#56687A' }}>
      <p>Redirecting to Easy Apply workflow...</p>
    </div>
  );
}