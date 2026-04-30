# API Documentation

## Profile Service (M1)

**Base URL:** `http://localhost:8002/api/members`  
**Database:** MySQL (`data236.members`)  
**Kafka Topics Produced:** `member.created`, `member.updated`, `profile.viewed`

---

### POST /api/members/create

Create a new member profile.

**Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "headline": "Software Engineer",
  "city": "San Francisco",
  "state": "CA",
  "country": "US",
  "skills": ["Python", "FastAPI"],
  "phone": "+1-555-0100",
  "about_summary": "Experienced backend engineer.",
  "experience": [],
  "education": []
}
```

**Success Response (200):**
```json
{ "success": true, "message": "Member created", "member_id": "uuid-here", "member": { ... } }
```

**Failure (duplicate email):**
```json
{ "success": false, "message": "Email already in use", "error": "Email already in use" }
```

---

### POST /api/members/get

Fetch a member profile by ID. Optionally emits a `profile.viewed` Kafka event.

**Request Body:**
```json
{
  "member_id": "uuid-here",
  "emit_profile_viewed": true,
  "viewer_id": "viewer-uuid",
  "view_source": "profile_page"
}
```

**Success Response (200):**
```json
{ "success": true, "message": "Member fetched successfully", "member": { ... } }
```

**Not Found (200):**
```json
{ "success": false, "message": "Member not found", "error": "Member not found" }
```

---

### POST /api/members/update

Update mutable fields of an existing member.

**Request Body:**
```json
{
  "member_id": "uuid-here",
  "headline": "Senior Engineer",
  "skills": ["Python", "Go"]
}
```

**Success Response (200):**
```json
{ "success": true, "message": "Member updated", "member_id": "uuid-here", "member": { ... } }
```

---

### POST /api/members/delete

Delete a member profile (also deletes their profile photo file).

**Request Body:**
```json
{ "member_id": "uuid-here" }
```

**Success Response (200):**
```json
{ "success": true, "message": "Member deleted successfully", "member_id": "uuid-here" }
```

---

### POST /api/members/search

Search members by keyword, skill, or location.

**Request Body:**
```json
{
  "keyword": "Engineer",
  "skill": "Python",
  "location": "San Francisco"
}
```

All fields are optional. Returns all members if the body is empty.

**Success Response (200):**
```json
{ "success": true, "message": "Members fetched successfully", "members": [ ... ] }
```

---

### POST /api/members/upload-photo

Upload a profile photo (multipart/form-data). Accepted types: jpg, jpeg, png, gif, webp. Max 5 MB.

**Form Fields:** `member_id` (optional), `file` (required)

**Success Response (200):**
```json
{ "success": true, "message": "Photo uploaded successfully", "profile_photo_url": "http://...", "filename": "photo_abc.jpg" }
```

---

### GET /health

```json
{ "success": true, "status": "ok", "service": "profile-service" }
```

---

---

## Job Service (M2)

**Base URL:** `http://localhost:3002/api/v1/jobs`  
**Database:** MySQL (`data236.job_postings`)  
**Kafka Topics Produced:** `job.created`, `job.updated`, `job.closed`, `job.viewed`, `job.saved`

---

### POST /api/v1/jobs/create

Create a new job posting.

**Request Body:**
```json
{
  "recruiter_id": "rec-001",
  "title": "Backend Engineer",
  "company_id": "comp-001",
  "location": "San Francisco, CA",
  "employment_type": "FULL_TIME",
  "seniority_level": "Mid-Senior",
  "remote": "hybrid",
  "description": "We are looking for...",
  "skills_required": ["Node.js", "MySQL"],
  "industry": "Technology",
  "salary_min": 120000,
  "salary_max": 160000
}
```

**Success Response (201):**
```json
{ "job_id": "uuid-here", "title": "Backend Engineer", "status": "open", ... }
```

---

### POST /api/v1/jobs/get

Fetch a single job by ID.

**Request Body:**
```json
{ "job_id": "uuid-here" }
```

**Success Response (200):**
```json
{ "job_id": "...", "title": "...", "status": "open", ... }
```

**Not Found (404):**
```json
{ "error": "Job not found" }
```

---

### POST /api/v1/jobs/update

Update fields on an existing job posting (recruiter only).

**Request Body:**
```json
{
  "job_id": "uuid-here",
  "recruiter_id": "rec-001",
  "title": "Senior Backend Engineer",
  "salary_max": 180000
}
```

---

### POST /api/v1/jobs/close

Close a job posting (no more applications accepted).

**Request Body:**
```json
{ "job_id": "uuid-here", "recruiter_id": "rec-001" }
```

---

### POST /api/v1/jobs/view

Emit a `job.viewed` event and increment the view counter.

**Request Body:**
```json
{ "job_id": "uuid-here", "viewer_id": "member-uuid", "trace_id": "trace-uuid" }
```

---

### POST /api/v1/jobs/save

Save a job for a member (emits `job.saved` event).

**Request Body:**
```json
{ "job_id": "uuid-here", "user_id": "member-uuid", "trace_id": "trace-uuid" }
```

---

### POST /api/v1/jobs/search

Search and paginate job postings. All filter fields are optional.

**Request Body:**
```json
{
  "keyword": "engineer",
  "location": "San Francisco",
  "employment_type": ["FULL_TIME", "CONTRACT"],
  "seniority_level": ["Mid-Senior", "Entry"],
  "remote": ["remote", "hybrid"],
  "industry": ["Technology", "Finance"],
  "salary_min": 100000,
  "page": 1,
  "limit": 15,
  "sort": "recent"
}
```

**Success Response (200):**
```json
{
  "jobs": [ { "job_id": "...", "title": "...", ... } ],
  "total": 240,
  "page": 1,
  "limit": 15
}
```

---

### POST /api/v1/jobs/byRecruiter

List all jobs posted by a specific recruiter.

**Request Body:**
```json
{ "recruiter_id": "rec-001" }
```

---

### GET /health

```json
{ "status": "ok", "service": "job-service" }
```

---

---

## Application Service (M3)

**Base URL:** `http://localhost:5003/applications`  
**Database:** MySQL (`application_db.applications`)  
**Kafka Topics Produced:** `application.submitted`, `application.status_updated`  
**Kafka Topics Consumed:** `job.closed` (auto-rejects open applications when a job closes)

---

### POST /applications/submit

Submit a job application (multipart/form-data with PDF resume).

**Form Fields:**
- `job_id` (required)
- `member_id` (required)
- `recruiter_id` (optional)
- `cover_letter` (optional)
- `resume` (required, PDF file)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "application_id": "app-uuid"
}
```

**Failure Cases:**
- `400` — Resume file missing or not a PDF
- `409` — Member already applied to this job
- `410` — Job is closed

---

### POST /applications/get

Fetch a single application by ID.

**Request Body:**
```json
{ "application_id": "app-uuid" }
```

**Success Response (200):**
```json
{
  "application_id": "...",
  "job_id": "...",
  "member_id": "...",
  "recruiter_id": "...",
  "status": "submitted",
  "cover_letter": "...",
  "resume_text": "...",
  "recruiter_note": null,
  "created_at": "...",
  "updated_at": "..."
}
```

**Not Found (404):** `{ "error": "Application not found" }`

---

### POST /applications/byMember

List all applications submitted by a member.

**Request Body:**
```json
{ "member_id": "member-uuid" }
```

**Success Response (200):** Array of application objects.

---

### POST /applications/byJob

List all applications for a specific job.

**Request Body:**
```json
{ "job_id": "job-uuid" }
```

**Success Response (200):** Array of application objects.

---

### POST /applications/updateStatus

Update the status of an application.

**Request Body:**
```json
{
  "application_id": "app-uuid",
  "status": "reviewed",
  "actor_id": "rec-uuid"
}
```

**Valid status values:** `submitted`, `reviewed`, `interview`, `offered`, `rejected`, `withdrawn`

**Success Response (200):**
```json
{ "success": true, "message": "Status updated", "application_id": "...", "status": "reviewed" }
```

**Failure Cases:**
- `400` — Invalid status value
- `404` — Application not found

---

### POST /applications/addNote

Add or update a recruiter note on an application.

**Request Body:**
```json
{ "application_id": "app-uuid", "recruiter_note": "Strong candidate, schedule interview." }
```

**Success Response (200):**
```json
{ "success": true, "message": "Note added", "application_id": "..." }
```

---

### GET /health

```json
{ "status": "ok", "service": "application-service" }
```
