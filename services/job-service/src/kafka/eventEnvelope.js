'use strict'

const crypto = require('crypto')

/** Fixed namespace UUID for DATA236 job-event idempotency (v5 name hashing). */
const JOB_IDEMPOTENCY_NAMESPACE =
  process.env.KAFKA_IDEMPOTENCY_NAMESPACE || 'a0000001-0000-5000-8000-000000000001'

/** RFC 4122 UUID v5 (SHA-1) — avoids ESM-only `uuid` package in Jest. */
function uuidv5 (name, namespaceUuid) {
  const nsHex = namespaceUuid.replace(/-/g, '')
  const nsBuf = Buffer.from(nsHex, 'hex')
  const hash = crypto.createHash('sha1')
  hash.update(nsBuf)
  hash.update(String(name), 'utf8')
  const bytes = Buffer.alloc(16)
  hash.digest().copy(bytes, 0, 0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Per team guideline #1: shared envelope for all Kafka messages.
 * @param {object} p
 * @param {string} p.eventType
 * @param {string} p.traceId - UUID v4
 * @param {string} p.actorId
 * @param {string} p.entityType
 * @param {string} p.entityId
 * @param {Record<string, unknown>} p.payload
 * @param {string} [p.idempotencyKey] - if omitted, derived for non-create flows
 */
function buildEnvelope ({
  eventType,
  traceId,
  actorId,
  entityType,
  entityId,
  payload,
  idempotencyKey
}) {
  const timestamp = new Date().toISOString()
  const key =
    idempotencyKey ||
    uuidv5(`${entityId}:${timestamp}`, JOB_IDEMPOTENCY_NAMESPACE)
  return {
    event_type: eventType,
    trace_id: traceId,
    timestamp,
    actor_id: actorId,
    entity: {
      entity_type: entityType,
      entity_id: entityId
    },
    payload,
    idempotency_key: key
  }
}

/**
 * W2: idempotency_key = UUID v5(job_id + timestamp) — PDF uses job_id and event timestamp.
 */
function idempotencyKeyJobCreated (jobId, timestampIso) {
  return uuidv5(`${jobId}:${timestampIso}`, JOB_IDEMPOTENCY_NAMESPACE)
}

function buildJobCreatedEnvelope ({
  jobId,
  title,
  companyId,
  recruiterId,
  location,
  employmentType,
  traceId
}) {
  const timestamp = new Date().toISOString()
  const idempotencyKey = idempotencyKeyJobCreated(jobId, timestamp)
  return {
    event_type: 'job.created',
    trace_id: traceId,
    timestamp,
    actor_id: recruiterId,
    entity: {
      entity_type: 'job',
      entity_id: jobId
    },
    payload: {
      job_id: jobId,
      title,
      company_id: companyId,
      location,
      employment_type: employmentType
    },
    idempotency_key: idempotencyKey
  }
}

module.exports = {
  buildEnvelope,
  buildJobCreatedEnvelope,
  idempotencyKeyJobCreated,
  JOB_IDEMPOTENCY_NAMESPACE
}
