'use strict'

/**
 * Fail fast when the stack is wrong or JWT secrets don't match integration defaults.
 */
const crypto = require('crypto')
const fetch = require('node-fetch')
const { getJwtSecret } = require('../jwt-config')

const JOB_URL = (process.env.JOB_URL || 'http://localhost:3002').replace(/\/$/, '')
const ANALYTICS_URL = (process.env.ANALYTICS_URL || 'http://localhost:4001').replace(/\/$/, '')
/** Prefer FastAPI default schema; bundled `/api/docs/openapi.json` may be absent in image. */
const OPENAPI_CANDIDATES = [`${JOB_URL}/openapi.json`, `${JOB_URL}/api/docs/openapi.json`]
const SKIP_ANALYTICS = process.env.SKIP_ANALYTICS_PREFLIGHT === '1'

function signJwt(payload) {
  const secret = getJwtSecret()
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

function recruiterBearer(id) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    member_id: id,
    sub: id,
    role: 'recruiter',
    exp: now + 7200,
    iat: now,
  }
  return `Bearer ${signJwt(payload)}`
}

async function checkOpenapi() {
  let lastErr = ''
  for (const url of OPENAPI_CANDIDATES) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)
    try {
      const res = await fetch(url, { signal: ac.signal })
      const text = await res.text()
      const looksLikeJson = text.trimStart().startsWith('{')
      const hasOpenapiKey =
        looksLikeJson &&
        (() => {
          try {
            return typeof JSON.parse(text).openapi === 'string'
          } catch {
            return false
          }
        })()
      if (res.ok && hasOpenapiKey) {
        console.log('preflight: job-service OpenAPI OK at', url)
        clearTimeout(timer)
        return
      }
      lastErr = `${url} → HTTP ${res.status}`
    } catch (e) {
      lastErr = `${url} (${e.message})`
    } finally {
      clearTimeout(timer)
    }
  }
  console.error(`preflight: no valid OpenAPI schema (${lastErr}).`)
  console.error(
    'Expected FastAPI job-service on JOB_URL (try curl "' + JOB_URL + '/openapi.json").',
  )
  console.error('Start the stack: cd infrastructure && docker compose up -d job-service')
  process.exit(1)
}

async function checkJobJwt() {
  const rid = crypto.randomUUID()
  const cid = crypto.randomUUID()
  const url = `${JOB_URL}/api/v1/jobs/create`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8000)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: recruiterBearer(rid),
      },
      body: JSON.stringify({
        title: 'preflight probe',
        company_id: cid,
        recruiter_id: rid,
        location: 'San Jose, CA',
        employment_type: 'Full-time',
      }),
    })
  } catch (e) {
    console.error(`preflight: job create probe failed (${e.message})`)
    process.exit(1)
    return
  } finally {
    clearTimeout(timer)
  }

  const status = res.status
  if (status === 401 || status === 403) {
    const body = await res.text()
    console.error(`preflight: job-service rejected JWT (HTTP ${status}). Body: ${body.slice(0, 200)}`)
    console.error(
      'JWT_SECRET / SECRET_KEY in tests must match running job-service + application-service.',
    )
    console.error(
      'Rebuild images after compose/env changes: docker compose build job-service application-service && docker compose up -d job-service application-service',
    )
    console.error(
      'Or export JWT_SECRET before tests to match the server (see docker-compose.yml).',
    )
    process.exit(1)
  }
  if (status === 201 || status === 400 || status === 409) {
    console.log('preflight: job-service JWT accepted (HTTP', status + ')')
    return
  }
  const errText = await res.text()
  console.error(`preflight: unexpected HTTP ${status} from job create probe:`, errText.slice(0, 300))
  process.exit(1)
}

async function checkAnalytics() {
  if (SKIP_ANALYTICS) {
    console.log('preflight: skipping analytics check (SKIP_ANALYTICS_PREFLIGHT=1)')
    return
  }
  const url = `${ANALYTICS_URL}/health`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) {
      console.error(`preflight: analytics ${url} returned HTTP ${res.status}`)
      process.exit(1)
      return
    }
    const data = await res.json().catch(() => ({}))
    if (data.status !== 'ok') {
      console.error('preflight: analytics health JSON unexpected:', data)
      process.exit(1)
      return
    }
    console.log('preflight: analytics-service OK at', url)
  } catch (e) {
    console.error(`preflight: cannot reach analytics ${url} (${e.message})`)
    console.error(
      'Start analytics (compose maps host 4001 → container 4000): docker compose up -d analytics-service',
    )
    console.error('To skip this check: SKIP_ANALYTICS_PREFLIGHT=1 npm run preflight')
    process.exit(1)
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  await checkOpenapi()
  await checkJobJwt()
  await checkAnalytics()
}

main()
