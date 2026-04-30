'use strict'

const { Kafka } = require('kafkajs')
const { buildJobCreatedEnvelope, buildEnvelope } = require('./eventEnvelope')

let kafkaSingleton = null
let producerSingleton = null

function brokerList () {
  return (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function getKafka () {
  const brokers = brokerList()
  if (!brokers.length) return null
  if (!kafkaSingleton) {
    kafkaSingleton = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'job-service',
      brokers
    })
  }
  return kafkaSingleton
}

async function getProducer () {
  const kafka = getKafka()
  if (!kafka) return null
  if (!producerSingleton) {
    producerSingleton = kafka.producer({
      allowAutoTopicCreation:
        String(process.env.KAFKA_AUTO_CREATE_TOPICS).toLowerCase() === 'true'
    })
    await producerSingleton.connect()
  }
  return producerSingleton
}

function sleep (ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry (fn, attempts = 3) {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i < attempts - 1) await sleep(200 * (i + 1))
    }
  }
  throw last
}

/**
 * Publish job.created after successful DB insert (W2).
 * No-op when KAFKA_BROKERS is unset. Retries with same envelope (same idempotency_key).
 */
async function sendJobCreated ({
  jobId,
  title,
  companyId,
  recruiterId,
  location,
  employmentType,
  traceId
}) {
  const kafka = getKafka()
  if (!kafka) return

  const envelope = buildJobCreatedEnvelope({
    jobId,
    title,
    companyId,
    recruiterId,
    location,
    employmentType,
    traceId
  })
  const topic = process.env.KAFKA_TOPIC_JOB_CREATED || 'job.created'

  await withRetry(async () => {
    const producer = await getProducer()
    await producer.send({
      topic,
      messages: [
        {
          key: jobId,
          value: JSON.stringify(envelope)
        }
      ]
    })
  })
}

async function sendEnvelopeEvent ({
  topic,
  key,
  eventType,
  traceId,
  actorId,
  entityType,
  entityId,
  payload
}) {
  const kafka = getKafka()
  if (!kafka) return
  const envelope = buildEnvelope({
    eventType,
    traceId,
    actorId,
    entityType,
    entityId,
    payload
  })

  await withRetry(async () => {
    const producer = await getProducer()
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(envelope) }]
    })
  })
}

async function sendJobClosed ({
  jobId,
  recruiterId,
  companyId,
  traceId
}) {
  const topic = process.env.KAFKA_TOPIC_JOB_CLOSED || 'job.closed'
  await sendEnvelopeEvent({
    topic,
    key: jobId,
    eventType: 'job.closed',
    traceId,
    actorId: recruiterId,
    entityType: 'job',
    entityId: jobId,
    payload: {
      job_id: jobId,
      recruiter_id: recruiterId,
      company_id: companyId || null,
      status: 'closed'
    }
  })
}

async function sendJobViewed ({
  jobId,
  viewerId,
  traceId
}) {
  const topic = process.env.KAFKA_TOPIC_JOB_VIEWED || 'job.viewed'
  await sendEnvelopeEvent({
    topic,
    key: jobId,
    eventType: 'job.viewed',
    traceId,
    actorId: viewerId,
    entityType: 'job',
    entityId: jobId,
    payload: {
      job_id: jobId,
      viewer_id: viewerId
    }
  })
}

async function sendJobSaved ({
  jobId,
  userId,
  traceId,
  sessionMeta = {}
}) {
  const topic = process.env.KAFKA_TOPIC_JOB_SAVED || 'job.saved'
  const savedAt = new Date().toISOString()
  await sendEnvelopeEvent({
    topic,
    key: jobId,
    eventType: 'job.saved',
    traceId,
    actorId: userId,
    entityType: 'job',
    entityId: jobId,
    payload: {
      job_id: jobId,
      user_id: userId,
      member_id: userId,
      saved_at: savedAt,
      session_trace_id: traceId,
      session_meta: sessionMeta
    }
  })
}

async function sendJobUnsaved ({ jobId, userId, traceId }) {
  const topic = process.env.KAFKA_TOPIC_JOB_SAVED || 'job.saved'
  await sendEnvelopeEvent({
    topic,
    key: jobId,
    eventType: 'job.unsaved',
    traceId,
    actorId: userId,
    entityType: 'job',
    entityId: jobId,
    payload: { job_id: jobId, user_id: userId, member_id: userId, unsaved_at: new Date().toISOString() }
  })
}

async function disconnectProducer () {
  if (producerSingleton) {
    try {
      await producerSingleton.disconnect()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Kafka producer disconnect:', e.message)
    }
    producerSingleton = null
  }
  kafkaSingleton = null
}

module.exports = {
  sendJobCreated,
  sendJobClosed,
  sendJobViewed,
  sendJobSaved,
  sendJobUnsaved,
  disconnectProducer,
  getKafka,
  brokerList
}
