'use strict'

const { PROFILE_URL, CONNECTION_URL, ANALYTICS_URL, AI_URL, post, get, uuid } = require('./helpers')

let memberA, memberB, connectionId

// ── Setup: two members ────────────────────────────────────────────
beforeAll(async () => {
  const mkMember = async (name) => {
    const { data } = await post(`${PROFILE_URL}/members/create`, {
      first_name: name, last_name: 'IntTest',
      email: `${name}_${uuid().slice(0,6)}@inttest.com`,
      city: 'Seattle', state: 'WA', country: 'USA',
    })
    return data.member_id
  }
  memberA = await mkMember('Alice')
  memberB = await mkMember('Bob')
})

afterAll(async () => {
  if (memberA) await post(`${PROFILE_URL}/members/delete`, { member_id: memberA })
  if (memberB) await post(`${PROFILE_URL}/members/delete`, { member_id: memberB })
})

// ── M4: Connections ───────────────────────────────────────────────
test('M4: send connection request', async () => {
  const { status, data } = await post(`${CONNECTION_URL}/connections/request`, {
    requester_id: memberA, receiver_id: memberB,
  })
  expect(status).toBe(201)
  connectionId = data.data?.connection_id
  expect(connectionId).toBeTruthy()
})

test('M4: duplicate request returns 409', async () => {
  const { status } = await post(`${CONNECTION_URL}/connections/request`, {
    requester_id: memberA, receiver_id: memberB,
  })
  expect(status).toBe(409)
})

test('M4: accept connection and connections_count increments', async () => {
  const before = await post(`${PROFILE_URL}/members/get`, { member_id: memberA })
  const countBefore = before.data.member?.connections_count || 0

  const { status, data } = await post(`${CONNECTION_URL}/connections/accept`, {
    connection_id: connectionId,
  })
  expect(status).toBe(200)
  expect(data.success).toBe(true)

  let countAfter = countBefore
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 250))
    const after = await post(`${PROFILE_URL}/members/get`, { member_id: memberA })
    countAfter = after.data.member?.connections_count || 0
    if (countAfter > countBefore) break
  }
  expect(countAfter).toBeGreaterThan(countBefore)
})

// ── M6: Analytics service health ─────────────────────────────────
test('M6: analytics service is healthy', async () => {
  const { status, data } = await get(`${ANALYTICS_URL}/health`)
  expect(status).toBe(200)
  expect(data.status).toBe('ok')
})

test('M6: ingest event via direct endpoint', async () => {
  const { status, data } = await post(`${ANALYTICS_URL}/events/ingest`, {
    event_type: 'test.event',
    trace_id: uuid(),
    timestamp: new Date().toISOString(),
    actor_id: memberA,
    entity: { entity_type: 'member', entity_id: memberA },
    payload: { test: true },
    idempotency_key: `test-${uuid()}`,
  })
  expect(status).toBe(201)
  expect(data.success).toBe(true)
})

test('M6: analytics events endpoint returns list', async () => {
  const { status, data } = await get(`${ANALYTICS_URL}/analytics/events?limit=5`)
  expect(status).toBe(200)
  expect(Array.isArray(data.events)).toBe(true)
})

test('M6: top jobs endpoint', async () => {
  const { status, data } = await get(`${ANALYTICS_URL}/analytics/jobs/top?limit=5`)
  expect(status).toBe(200)
  expect(Array.isArray(data.jobs)).toBe(true)
})

test('M6: funnel endpoint', async () => {
  const { status, data } = await get(`${ANALYTICS_URL}/analytics/funnel`)
  expect(status).toBe(200)
  expect(Array.isArray(data.funnel)).toBe(true)
  const submit = data.funnel.find((s) => s.stage === 'submit')
  expect(typeof submit?.count).toBe('number')
})

// ── M5: AI service ────────────────────────────────────────────────
test('M5: ai service health', async () => {
  const { status, data } = await get(`${AI_URL}/health`)
  expect(status).toBe(200)
  expect(data.status).toBe('ok')
})

test('M5: parse resume extracts skills', async () => {
  const { status, data } = await post(`${AI_URL}/ai/parse-resume`, {
    resume_text: 'John Doe — 6 years of experience in Python, React, and SQL. john@example.com',
  })
  expect(status).toBe(200)
  expect(data.parsed.skills).toContain('python')
  expect(data.parsed.inferred_seniority).toBe('senior')
})

test('M5: match job returns score', async () => {
  const { status, data } = await post(`${AI_URL}/ai/match-job`, {
    candidate_skills: ['python', 'sql', 'react'],
    job_skills: ['python', 'sql', 'java'],
    seniority_match: true,
  })
  expect(status).toBe(200)
  expect(data.match.score).toBeGreaterThan(0)
  expect(data.match.matched_skills).toContain('python')
})

test('M5: full hiring task completes', async () => {
  const { status, data } = await post(`${AI_URL}/ai/hiring-task`, {
    job_id: uuid(),
    job_skills: ['python', 'sql'],
    job_seniority: 'senior',
    resumes: [
      { text: 'Alice has 7 years of Python and SQL. alice@test.com' },
      { text: 'Bob knows Java and C++. bob@test.com' },
    ],
  })
  expect(status).toBe(200)
  expect(data.task.result.candidates_ranked.length).toBe(2)
  const top = data.task.result.candidates_ranked[0]
  expect(top.score).toBeGreaterThanOrEqual(0)
})
