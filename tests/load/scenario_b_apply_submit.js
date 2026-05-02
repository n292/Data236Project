/**
 * Scenario B — Apply Submit (DB write + Kafka event)
 *
 * Simulates 100 concurrent users each performing:
 *   1. Submit a job application (multipart/form-data with resume PDF stub)
 *   2. Observe status 201 and correct JSON body
 *
 * Four configurations (K6_CONFIG env var):
 *   B        — DB write only (Kafka disabled)
 *   B+S      — DB write + Redis cache on job lookup
 *   B+S+K    — DB write + Kafka application.submitted published
 *   B+S+K+O  — All of the above + analytics consumer active
 *
 * Run:
 *   k6 run -e K6_CONFIG=B      tests/load/scenario_b_apply_submit.js
 *   k6 run --out csv=results/scenario_b_B.csv -e K6_CONFIG=B      tests/load/scenario_b_apply_submit.js
 *   k6 run --out csv=results/scenario_b_BpS.csv -e K6_CONFIG=B+S  tests/load/scenario_b_apply_submit.js
 *   ... etc
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ── Custom metrics ───────────────────────────────────────────────────────────
const submitLatency = new Trend('submit_latency_ms', true)
const submitErrors  = new Rate('submit_error_rate')
const totalApps     = new Counter('total_applications')
const duplicateRej  = new Counter('duplicate_rejections')

// ── Config ───────────────────────────────────────────────────────────────────
const APP_SERVICE_URL = __ENV.APP_SERVICE_URL || 'http://localhost:5003'
const JOB_SERVICE_URL = __ENV.JOB_SERVICE_URL || 'http://localhost:3002'
const K6_CONFIG       = __ENV.K6_CONFIG       || 'B'

// Pre-seeded job IDs — use real IDs from your seed data or override via env
const SEED_JOB_IDS = (__ENV.JOB_IDS || '').split(',').filter(Boolean)

// ── Load profile ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    apply_submit: {
      executor: 'constant-vus',
      vus: 100,
      duration: '60s',
    },
  },
  thresholds: {
    submit_latency_ms: ['p(95)<1000'],  // 1s budget for DB + Kafka
    submit_error_rate: ['rate<0.05'],
    http_req_failed:   ['rate<0.05'],
  },
  tags: { config: K6_CONFIG },
}

// ── Setup: discover job IDs if not provided ───────────────────────────────────
export function setup() {
  if (SEED_JOB_IDS.length > 0) return { jobIds: SEED_JOB_IDS }

  const res = http.post(
    `${JOB_SERVICE_URL}/api/v1/jobs/search`,
    JSON.stringify({ keyword: 'engineer', limit: 50, page: 1 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  let jobIds = []
  try {
    jobIds = JSON.parse(res.body).jobs?.map(j => j.job_id) || []
  } catch { /* */ }

  if (jobIds.length === 0) {
    console.warn('[setup] No jobs found — using placeholder IDs')
    jobIds = Array.from({ length: 20 }, (_, i) => `job-placeholder-${i}`)
  }
  console.log(`[setup] Using ${jobIds.length} job IDs for load test`)
  return { jobIds }
}

// ── Tiny PDF stub (valid but minimal) ────────────────────────────────────────
// Real multipart upload would send a file; for load testing we send a minimal stub.
const STUB_PDF = '%PDF-1.4 stub resume for load test'

// ── Main test function ────────────────────────────────────────────────────────
export default function (data) {
  const jobIds   = data.jobIds || []
  if (jobIds.length === 0) { sleep(1); return }

  const jobId    = jobIds[Math.floor(Math.random() * jobIds.length)]
  const memberId = `load-member-${__VU}-${uuidv4().slice(0, 8)}`

  const formData = {
    job_id:       jobId,
    member_id:    memberId,
    cover_letter: `Load test application from VU ${__VU}`,
    // k6 multipart file upload
    resume: http.file(STUB_PDF, 'resume.pdf', 'application/pdf'),
  }

  const res = http.post(
    `${APP_SERVICE_URL}/api/applications/submit`,
    formData,
    { tags: { name: 'application_submit' } }
  )

  totalApps.add(1)
  submitLatency.add(res.timings.duration)

  const ok = check(res, {
    'submit status 201':    r => r.status === 201,
    'has application_id':   r => { try { return !!JSON.parse(r.body).application?.application_id } catch { return false } },
  })

  if (res.status === 409) duplicateRej.add(1)
  submitErrors.add(!ok && res.status !== 409) // 409 duplicate is expected, not an error

  sleep(Math.random() * 0.3 + 0.1) // 100–400ms think time
}

export function handleSummary(data) {
  const config = K6_CONFIG
  const metrics = data.metrics

  const p50  = metrics.submit_latency_ms?.values?.['p(50)']  || 0
  const p95  = metrics.submit_latency_ms?.values?.['p(95)']  || 0
  const p99  = metrics.submit_latency_ms?.values?.['p(99)']  || 0
  const rps  = metrics.http_reqs?.values?.rate || 0
  const apps = metrics.total_applications?.values?.count || 0
  const dups = metrics.duplicate_rejections?.values?.count || 0
  const err  = (metrics.submit_error_rate?.values?.rate || 0) * 100

  console.log(`\n===== Scenario B [${config}] =====`)
  console.log(`p50 submit latency : ${p50.toFixed(1)} ms`)
  console.log(`p95 submit latency : ${p95.toFixed(1)} ms`)
  console.log(`p99 submit latency : ${p99.toFixed(1)} ms`)
  console.log(`Throughput         : ${rps.toFixed(1)} req/s`)
  console.log(`Total applications : ${apps}`)
  console.log(`Duplicate 409s     : ${dups} (expected)`)
  console.log(`Error rate         : ${err.toFixed(2)}%`)
  console.log(`================================\n`)

  return {
    stdout: `Scenario B [${config}] — p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms rps=${rps.toFixed(1)} apps=${apps}\n`,
  }
}
