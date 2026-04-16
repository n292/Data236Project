'use strict'

const path = require('path')
const { Kafka } = require('kafkajs')
const { getPool, resetPoolForTests } = require('../src/db/pool')
const { handleApplicationSubmittedEnvelope } = require('../src/kafka/applicationSubmittedHandler')

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

describeIfKafka('Kafka integration: application.submitted -> applicants_count', () => {
  let pool
  let producer
  let consumer
  let kafka
  let jobId
  let idempotencyKey
  const topic = process.env.KAFKA_TOPIC_APPLICATION_SUBMITTED || 'application.submitted'

  beforeAll(async () => {
    if (!process.env.KAFKA_BROKERS) {
      throw new Error('Set KAFKA_BROKERS for integration test')
    }

    pool = getPool()
    kafka = new Kafka({
      clientId: `job-service-it-producer-${Date.now()}`,
      brokers: process.env.KAFKA_BROKERS.split(',').map((s) => s.trim()).filter(Boolean)
    })
    producer = kafka.producer()
    consumer = kafka.consumer({
      groupId: `job-service-it-${Date.now()}`
    })
    await producer.connect()
    await consumer.connect()
    await consumer.subscribe({ topic, fromBeginning: false })
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value && message.value.toString()
        if (!raw) return
        const envelope = JSON.parse(raw)
        await handleApplicationSubmittedEnvelope(envelope)
      }
    })
  })

  afterAll(async () => {
    try {
      if (producer) await producer.disconnect()
      if (consumer) {
        await consumer.stop()
        await consumer.disconnect()
      }
    } finally {
      if (pool) await pool.end()
      resetPoolForTests()
    }
  })

  beforeEach(async () => {
    jobId = uuidLike()
    idempotencyKey = `app-submitted-${uuidLike()}`
    const companyId = uuidLike()
    const recruiterId = uuidLike()

    await pool.query(
      `INSERT INTO job_postings
       (job_id, company_id, recruiter_id, title, employment_type, location, remote, status, applicants_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, companyId, recruiterId, 'Kafka IT Job', 'FULL_TIME', 'Remote', 'remote', 'open', 0]
    )
  })

  afterEach(async () => {
    await pool.query('DELETE FROM processed_events WHERE idempotency_key = ?', [idempotencyKey])
    await pool.query('DELETE FROM job_postings WHERE job_id = ?', [jobId])
  })

  it('increments applicants_count exactly once for duplicate delivery', async () => {
    const traceId = uuidLike()
    const envelope = {
      event_type: 'application.submitted',
      trace_id: traceId,
      actor_id: uuidLike(),
      entity: { entity_type: 'application', entity_id: uuidLike() },
      payload: { job_id: jobId, member_id: uuidLike() },
      idempotency_key: idempotencyKey
    }

    await producer.send({
      topic,
      messages: [{ key: idempotencyKey, value: JSON.stringify(envelope) }]
    })

    const firstApplied = await waitFor(async () => {
      const [rows] = await pool.query(
        'SELECT applicants_count FROM job_postings WHERE job_id = ?',
        [jobId]
      )
      return Number(rows[0]?.applicants_count || 0) === 1
    })
    expect(firstApplied).toBe(true)

    await producer.send({
      topic,
      messages: [{ key: idempotencyKey, value: JSON.stringify(envelope) }]
    })

    await new Promise((resolve) => setTimeout(resolve, 900))
    const [rows] = await pool.query(
      'SELECT applicants_count FROM job_postings WHERE job_id = ?',
      [jobId]
    )
    expect(Number(rows[0]?.applicants_count || 0)).toBe(1)

    const [processed] = await pool.query(
      'SELECT idempotency_key FROM processed_events WHERE idempotency_key = ?',
      [idempotencyKey]
    )
    expect(processed).toHaveLength(1)
  })
})
