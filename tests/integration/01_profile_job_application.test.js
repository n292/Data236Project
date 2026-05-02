'use strict'

const FormData = require('node-fetch').FormData || require('form-data')
const fetch = require('node-fetch')
const path = require('path')
const fs = require('fs')
const {
  PROFILE_URL,
  JOB_URL,
  APP_URL,
  bearerAuth,
  profileBearer,
  post,
  get,
  uuid,
} = require('./helpers')

const jobApi = (path) => `${JOB_URL}/api/v1/jobs${path}`

let memberId, memberToken, recruiterId, jobId, applicationId

// ── 1. Register member (User row + JWT required for /members/delete and /members/update) ──
test('M1: register member', async () => {
  const email = `int_test_${uuid().slice(0, 8)}@example.com`
  const password = 'TestPassword123!'
  let { status, data } = await post(`${PROFILE_URL}/auth/register`, {
    first_name: 'Integration',
    last_name: 'Tester',
    email,
    password,
    role: 'member',
  })
  expect(status).toBe(200)
  expect(data.success).toBe(true)
  memberToken = data.token
  expect(memberToken).toBeTruthy()

  const meRes = await fetch(`${PROFILE_URL}/auth/me`, {
    headers: profileBearer(memberToken),
  })
  expect(meRes.status).toBe(200)
  const meJson = await meRes.json()
  memberId = meJson.user.member_id
  expect(memberId).toBeTruthy()

  ;({ status, data } = await post(
    `${PROFILE_URL}/members/update`,
    {
      member_id: memberId,
      headline: 'Test engineer',
      city: 'San Jose',
      state: 'CA',
      country: 'USA',
      skills: ['Python', 'Testing'],
    },
    profileBearer(memberToken),
  ))
  expect(status).toBe(200)
  expect(data.success).toBe(true)
})

// ── 2. Get member ─────────────────────────────────────────────────
test('M1: get member by id', async () => {
  const { status, data } = await post(`${PROFILE_URL}/members/get`, { member_id: memberId })
  expect(status).toBe(200)
  expect(data.member.first_name).toBe('Integration')
})

// ── 3. Search member ──────────────────────────────────────────────
test('M1: search members by skill', async () => {
  const { status, data } = await post(`${PROFILE_URL}/members/search`, { skill: 'Testing' })
  expect(status).toBe(200)
  expect(Array.isArray(data.members)).toBe(true)
})

// ── 4. Create job ─────────────────────────────────────────────────
test('M2: create job posting', async () => {
  recruiterId = uuid()
  const companyId = uuid()
  const { status, data } = await post(
    jobApi('/create'),
    {
      title: 'Integration Test Engineer',
      company_id: companyId,
      recruiter_id: recruiterId,
      location: 'San Jose, CA',
      employment_type: 'Full-time',
      skills_required: ['Python', 'Testing'],
    },
    bearerAuth(recruiterId, 'recruiter'),
  )
  expect(status).toBe(201)
  jobId = data.job_id
  expect(jobId).toBeTruthy()
})

// ── 5. Get job ───────────────────────────────────────────────────
test('M2: get job by id', async () => {
  const { status, data } = await post(jobApi('/get'), { job_id: jobId })
  expect(status).toBe(200)
  expect(data.title).toBe('Integration Test Engineer')
})

// ── 6. Search jobs ───────────────────────────────────────────────
test('M2: search jobs', async () => {
  const { status, data } = await post(jobApi('/search'), { page: 1, limit: 5 })
  expect(status).toBe(200)
  expect(Array.isArray(data.jobs)).toBe(true)
})

// ── 7. Save job ──────────────────────────────────────────────────
test('M2: save job persists to DB', async () => {
  const { status, data } = await post(
    jobApi('/save'),
    { job_id: jobId, user_id: memberId },
    bearerAuth(memberId, 'member'),
  )
  expect(status).toBe(200)
  expect(data.status).toBe('saved')

  // Verify persistence
  const { status: s2, data: d2 } = await post(
    jobApi('/saved'),
    { user_id: memberId },
    bearerAuth(memberId, 'member'),
  )
  expect(s2).toBe(200)
  expect(d2.jobs.some(j => j.job_id === jobId)).toBe(true)
})

// ── 8. Submit application ────────────────────────────────────────
test('M3: submit application (DB write + Kafka)', async () => {
  // Create a tiny fake PDF buffer
  const fakePdf = Buffer.from('%PDF-1.4 fake resume content')
  const FormDataModule = require('form-data')
  const form = new FormDataModule()
  form.append('job_id', jobId)
  form.append('member_id', memberId)
  form.append('recruiter_id', recruiterId)
  form.append('cover_letter', 'Integration test cover letter')
  form.append('resume', fakePdf, { filename: 'resume.pdf', contentType: 'application/pdf' })

  const res = await fetch(`${APP_URL}/applications/submit`, {
    method: 'POST',
    body: form,
    headers: { ...form.getHeaders(), ...bearerAuth(memberId, 'member') },
  })
  const data = await res.json()
  expect(res.status).toBe(201)
  applicationId = data.application?.application_id
  expect(applicationId).toBeTruthy()
})

// ── 9. Get application ───────────────────────────────────────────
test('M3: get application by id (verifies DB was written)', async () => {
  const { status, data } = await post(`${APP_URL}/applications/get`, { application_id: applicationId })
  expect(status).toBe(200)
  expect(data.application_id).toBe(applicationId)
  expect(data.status).toBe('submitted')
})

// ── 10. Get member applications ───────────────────────────────────
test('M3: list applications by member', async () => {
  const { status, data } = await post(
    `${APP_URL}/applications/byMember`,
    { member_id: memberId },
    bearerAuth(memberId, 'member'),
  )
  expect(status).toBe(200)
  expect(Array.isArray(data)).toBe(true)
  expect(data.some(a => a.application_id === applicationId)).toBe(true)
})

// ── 11. Duplicate application rejected ───────────────────────────
test('M3: duplicate application returns 409', async () => {
  const fakePdf = Buffer.from('%PDF-1.4 fake')
  const FormDataModule = require('form-data')
  const form = new FormDataModule()
  form.append('job_id', jobId)
  form.append('member_id', memberId)
  form.append('resume', fakePdf, { filename: 'resume.pdf', contentType: 'application/pdf' })

  const res = await fetch(`${APP_URL}/applications/submit`, {
    method: 'POST',
    body: form,
    headers: { ...form.getHeaders(), ...bearerAuth(memberId, 'member') },
  })
  expect(res.status).toBe(409)
})

// ── 12. Update application status ────────────────────────────────
test('M3: update application status to reviewed', async () => {
  const { status, data } = await post(
    `${APP_URL}/applications/updateStatus`,
    { application_id: applicationId, status: 'reviewed' },
    bearerAuth(recruiterId, 'recruiter'),
  )
  expect(status).toBe(200)
  expect(data.application.status).toBe('reviewed')
})

// ── 13. Clean up: delete member ───────────────────────────────────
test('M1: delete member', async () => {
  const { status, data } = await post(
    `${PROFILE_URL}/members/delete`,
    { member_id: memberId },
    profileBearer(memberToken),
  )
  expect(status).toBe(200)
  expect(data.success).toBe(true)
})
