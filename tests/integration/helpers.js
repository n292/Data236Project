'use strict'

const crypto = require('crypto')
const fetch = require('node-fetch')
const { getJwtSecret } = require('./jwt-config')

const PROFILE_URL = process.env.PROFILE_URL || 'http://localhost:8002/api'
/** Job-service host only — paths must include `/api/v1/jobs/...`. */
const JOB_URL = process.env.JOB_URL || 'http://localhost:3002'
const APP_URL = process.env.APP_URL || 'http://localhost:5003'
const CONNECTION_URL = process.env.CONNECTION_URL || 'http://localhost:3005/api'
/** Published host port (compose maps container 4000 → host 4001). */
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:4001'
const AI_URL = process.env.AI_URL || 'http://localhost:8015'

/** @deprecated use getJwtSecret() from ./jwt-config — kept for assertions/logging */
const JWT_SECRET = getJwtSecret()

/**
 * HS256 JWT compatible with profile-service (python-jose) and job/application FastAPI verify.
 */
function signJwt(payload) {
  const secret = getJwtSecret()
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

function bearerAuth(memberOrRecruiterId, role) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    member_id: memberOrRecruiterId,
    sub: memberOrRecruiterId,
    role,
    exp: now + 7200,
    iat: now,
  }
  return { Authorization: `Bearer ${signJwt(payload)}` }
}

/** Profile-service access_token from /auth/register or /auth/login (HS256, SECRET_KEY). */
function profileBearer(accessToken) {
  return { Authorization: `Bearer ${accessToken}` }
}

async function post(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function get(url) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function uuid() {
  return crypto.randomUUID()
}

module.exports = {
  PROFILE_URL,
  JOB_URL,
  APP_URL,
  CONNECTION_URL,
  ANALYTICS_URL,
  AI_URL,
  JWT_SECRET,
  getJwtSecret,
  signJwt,
  bearerAuth,
  profileBearer,
  post,
  get,
  uuid,
}
