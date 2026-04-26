export const CURRENT_MEMBER = {
  member_id: "mem-001",
  name: "Jordan Ellis",
  headline: "Software Engineer",
  email: "jordan.ellis@email.com",
};

export const DEMO_JOBS = [
  {
    job_id: "job-001",
    title: "Senior Frontend Engineer",
    company: "Google",
    location: "Mountain View, CA",
    workplace_type: "Hybrid",
    employment_type: "Full-time",
    recruiter_id: "rec-001",
    description:
      "Build scalable frontend applications for millions of users. Work closely with product, design, and backend teams to deliver polished, performant interfaces.",
    requirements: [
      "5+ years of React or similar frontend framework experience",
      "Strong JavaScript / TypeScript skills",
      "Experience with design systems and accessibility",
    ],
  },
  {
    job_id: "job-002",
    title: "Backend Java Engineer",
    company: "Amazon",
    location: "Seattle, WA",
    workplace_type: "On-site",
    employment_type: "Full-time",
    recruiter_id: "rec-002",
    description:
      "Design and maintain distributed backend services using Java, Spring Boot, Kafka, and MySQL. Partner with platform teams on reliability and performance improvements.",
    requirements: [
      "3+ years of Java and Spring Boot",
      "Knowledge of microservices and REST APIs",
      "Comfort with SQL databases and event-driven systems",
    ],
  },
  {
    job_id: "job-003",
    title: "Full Stack Developer",
    company: "LinkedIn Learning Lab",
    location: "San Jose, CA",
    workplace_type: "Remote",
    employment_type: "Internship",
    recruiter_id: "rec-003",
    description:
      "Contribute across the stack on internal tools and candidate workflows. Build frontend features, backend APIs, and improve developer productivity across the project.",
    requirements: [
      "React, Node.js, and MySQL basics",
      "Comfort reading existing codebases",
      "Strong debugging and collaboration skills",
    ],
  },
];

export function getJobById(jobId) {
  return DEMO_JOBS.find((job) => job.job_id === jobId) || null;
}