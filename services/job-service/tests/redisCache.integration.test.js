'use strict'

const path = require('path')
const request = require('supertest')
const { createClient } = require('redis')
const { getPool, resetPoolForTests } = require('../src/db/pool')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const shouldRun = process.env.RUN_REDIS_IT === 'true'
const describeIfRedis = shouldRun ? describe : describe.skip

function uuidLike () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

describeIfRedis('Redis integration: search/get cache + invalidation', () => {
  let app
  let pool
  let redis
  let jobId
  let recruiterId
  let locationTag

  beforeAll(async () => {
    process.env.KAFKA_BROKERS = ''
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

    redis = createClient({ url: process.env.REDIS_URL })
    await redis.connect()
    await redis.ping()

    app = require('../src/app')
    pool = getPool()
  })

  afterAll(async () => {
    try {
      if (redis && redis.isOpen) await redis.quit()
    } finally {
      if (pool) await pool.end()
      resetPoolForTests()
    }
  })

  beforeEach(async () => {
    jobId = uuidLike()
    recruiterId = uuidLike()
    locationTag = `redis-it-${Date.now()}`
    const companyId = uuidLike()

    await pool.query(
      `INSERT INTO job_postings
       (job_id, company_id, recruiter_id, title, employment_type, location, remote, status, applicants_count, views_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [jobId, companyId, recruiterId, 'Redis Integration Job', 'FULL_TIME', locationTag, 'onsite', 'open']
    )
    await redis.flushDb()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM job_postings WHERE job_id = ?', [jobId])
    await redis.flushDb()
  })

  it('caches get/search and invalidates on update + close', async () => {
    const getKey = `cache:jobs:get:${jobId}`

    const getRes1 = await request(app)
      .post('/api/v1/jobs/get')
      .send({ job_id: jobId })
    expect(getRes1.status).toBe(200)

    const cachedGet = await redis.get(getKey)
    expect(cachedGet).toBeTruthy()

    const searchPayload = { page: 1, limit: 10, location: locationTag }
    const searchRes1 = await request(app)
      .post('/api/v1/jobs/search')
      .send(searchPayload)
    expect(searchRes1.status).toBe(200)
    expect(Array.isArray(searchRes1.body.jobs)).toBe(true)

    const searchKeysBefore = await redis.sMembers('cache:jobs:search:keys')
    expect(searchKeysBefore.length).toBeGreaterThan(0)

    const updateRes = await request(app)
      .post('/api/v1/jobs/update')
      .send({
        job_id: jobId,
        recruiter_id: recruiterId,
        title: 'Redis Integration Job Updated'
      })
    expect(updateRes.status).toBe(200)

    const cachedGetAfterUpdate = await redis.get(getKey)
    expect(cachedGetAfterUpdate).toBeNull()
    const searchKeysAfterUpdate = await redis.sMembers('cache:jobs:search:keys')
    expect(searchKeysAfterUpdate).toHaveLength(0)

    await request(app).post('/api/v1/jobs/get').send({ job_id: jobId })
    const recachedGet = await redis.get(getKey)
    expect(recachedGet).toBeTruthy()

    const closeRes = await request(app)
      .post('/api/v1/jobs/close')
      .send({
        job_id: jobId,
        recruiter_id: recruiterId
      })
    expect(closeRes.status).toBe(200)

    const getClosedRes = await request(app)
      .post('/api/v1/jobs/get')
      .send({ job_id: jobId })
    expect(getClosedRes.status).toBe(200)
    expect(getClosedRes.body.status).toBe('closed')

    const cacheAfterClosedGet = await redis.get(getKey)
    expect(cacheAfterClosedGet).toBeNull()
  })
})
