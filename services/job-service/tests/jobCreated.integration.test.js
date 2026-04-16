'use strict'

const path = require('path')
const request = require('supertest')
const { Kafka } = require('kafkajs')
const { getPool, resetPoolForTests } = require('../src/db/pool')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const shouldRun = process.env.RUN_KAFKA_IT === 'true'
const describeIfKafka = shouldRun ? describe : describe.skip

function uuidLike () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function waitFor (predicate, timeoutMs = 12000, intervalMs = 300) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const done = await predicate()
    if (done) return true
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

describeIfKafka('Kafka integration: /jobs/create emits job.created', () => {
  let app
  let pool
  let kafka
  let consumer
  let observedMessage = null

  beforeAll(async () => {
    if (!process.env.KAFKA_BROKERS) {
      throw new Error('Set KAFKA_BROKERS for integration test')
    }
    app = require('../src/app')
    pool = getPool()
    kafka = new Kafka({
      clientId: `job-created-it-${Date.now()}`,
      brokers: process.env.KAFKA_BROKERS.split(',').map((s) => s.trim()).filter(Boolean)
    })
    consumer = kafka.consumer({ groupId: `job-created-it-group-${Date.now()}` })
    await consumer.connect()
    await consumer.subscribe({
      topic: process.env.KAFKA_TOPIC_JOB_CREATED || 'job.created',
      fromBeginning: false
    })
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value && message.value.toString()
        if (!raw) return
        observedMessage = JSON.parse(raw)
      }
    })
  })

  afterAll(async () => {
    try {
      if (consumer) {
        await consumer.stop()
        await consumer.disconnect()
      }
    } finally {
      if (pool) await pool.end()
      resetPoolForTests()
    }
  })

  it('publishes envelope with trace_id and job entity', async () => {
    observedMessage = null
    const companyId = uuidLike()
    const recruiterId = uuidLike()
    const traceId = uuidLike()

    const res = await request(app)
      .post('/api/v1/jobs/create')
      .set('x-trace-id', traceId)
      .send({
        title: 'Kafka Create IT Job',
        company_id: companyId,
        recruiter_id: recruiterId,
        location: 'San Jose',
        employment_type: 'FULL_TIME'
      })

    expect(res.status).toBe(201)
    expect(res.body.job_id).toBeTruthy()

    const gotMessage = await waitFor(() => Boolean(observedMessage))
    expect(gotMessage).toBe(true)
    expect(observedMessage.event_type).toBe('job.created')
    expect(observedMessage.trace_id).toBe(traceId)
    expect(observedMessage.entity.entity_type).toBe('job')
    expect(observedMessage.entity.entity_id).toBe(res.body.job_id)
    expect(observedMessage.payload.job_id).toBe(res.body.job_id)

    await pool.query('DELETE FROM job_postings WHERE job_id = ?', [res.body.job_id])
  })
})
