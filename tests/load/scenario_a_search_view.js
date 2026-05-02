/**
 * Scenario A — Job Search + Job Detail View
 *
 * Simulates 100 concurrent users each performing:
 *   1. Search jobs by keyword
 *   2. View the first returned job's detail
 *
 * Four configurations (controlled by K6_CONFIG env var):
 *   B        — Baseline: search + view only (no Redis, no Kafka)
 *   B+S      — + Redis cache warm (service has Redis enabled)
 *   B+S+K    — + Kafka job.viewed event published
 *   B+S+K+O  — + Analytics service consuming the event
 *
 * Run:
 *   k6 run -e K6_CONFIG=B      tests/load/scenario_a_search_view.js
 *   k6 run -e K6_CONFIG=B+S    tests/load/scenario_a_search_view.js
 *   k6 run -e K6_CONFIG=B+S+K  tests/load/scenario_a_search_view.js
 *   k6 run -e K6_CONFIG=B+S+K+O tests/load/scenario_a_search_view.js
 *
 * Output CSV:
 *   k6 run --out csv=results/scenario_a_$(date +%s).csv ... scenario_a_search_view.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'

// ── Custom metrics ───────────────────────────────────────────────────────────
const searchLatency  = new Trend('search_latency_ms',  true)
const detailLatency  = new Trend('detail_latency_ms',  true)
const searchErrors   = new Rate('search_error_rate')
const detailErrors   = new Rate('detail_error_rate')
const totalRequests  = new Counter('total_requests')

// ── Config ───────────────────────────────────────────────────────────────────
const JOB_SERVICE_URL  = __ENV.JOB_SERVICE_URL  || 'http://localhost:3002'
const K6_CONFIG        = __ENV.K6_CONFIG        || 'B'

// Representative keywords drawn from seed data
const KEYWORDS = [
  'engineer', 'manager', 'analyst', 'developer', 'designer',
  'marketing', 'sales', 'finance', 'data', 'product',
]

// ── Load profile ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    search_and_view: {
      executor: 'constant-vus',
      vus: 100,
      duration: '60s',
    },
  },
  thresholds: {
    // 95th percentile search < 500ms, detail < 300ms
    search_latency_ms: ['p(95)<500'],
    detail_latency_ms: ['p(95)<300'],
    search_error_rate: ['rate<0.02'],
    detail_error_rate: ['rate<0.02'],
    http_req_failed:   ['rate<0.05'],
  },
  tags: { config: K6_CONFIG },
}

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)]

  // Step 1: Search
  const searchRes = http.post(
    `${JOB_SERVICE_URL}/api/v1/jobs/search`,
    JSON.stringify({ keyword, limit: 10, page: 1 }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'job_search' } }
  )
  totalRequests.add(1)
  searchLatency.add(searchRes.timings.duration)

  const searchOk = check(searchRes, {
    'search status 200': r => r.status === 200,
    'search has jobs':   r => { try { return JSON.parse(r.body).jobs?.length >= 0 } catch { return false } },
  })
  searchErrors.add(!searchOk)

  if (!searchOk) { sleep(0.5); return }

  // Step 2: View first job detail
  let jobs = []
  try { jobs = JSON.parse(searchRes.body).jobs || [] } catch { /* */ }

  if (jobs.length > 0) {
    const jobId = jobs[0].job_id
    const viewRes = http.post(
      `${JOB_SERVICE_URL}/api/v1/jobs/view`,
      JSON.stringify({ job_id: jobId, viewer_id: `load-test-${__VU}` }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'job_view' } }
    )
    totalRequests.add(1)
    detailLatency.add(viewRes.timings.duration)

    const detailOk = check(viewRes, {
      'view status 200': r => r.status === 200,
    })
    detailErrors.add(!detailOk)
  }

  sleep(Math.random() * 0.5 + 0.1) // 100–600ms think time
}

export function handleSummary(data) {
  const config = K6_CONFIG
  const ts     = new Date().toISOString().replace(/[:.]/g, '-')
  const out    = {}

  // Print summary to stdout
  const metrics = data.metrics
  const p95search = metrics.search_latency_ms?.values?.['p(95)'] || 0
  const p95detail = metrics.detail_latency_ms?.values?.['p(95)'] || 0
  const rps       = metrics.http_reqs?.values?.rate || 0

  console.log(`\n===== Scenario A [${config}] =====`)
  console.log(`p95 search latency : ${p95search.toFixed(1)} ms`)
  console.log(`p95 detail latency : ${p95detail.toFixed(1)} ms`)
  console.log(`Throughput         : ${rps.toFixed(1)} req/s`)
  console.log(`Total requests     : ${metrics.total_requests?.values?.count || 0}`)
  console.log(`Search error rate  : ${((metrics.search_error_rate?.values?.rate || 0) * 100).toFixed(2)}%`)
  console.log(`================================\n`)

  out['stdout'] = `Scenario A [${config}] — p95 search=${p95search.toFixed(1)}ms detail=${p95detail.toFixed(1)}ms rps=${rps.toFixed(1)}\n`

  return out
}
