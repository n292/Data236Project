'use strict'

const { getPool } = require('../db/pool')

/**
 * Idempotent handling of job.viewed.
 * Increments views_count once per idempotency_key.
 */
async function handleJobViewedEnvelope (envelope) {
  if (!envelope || typeof envelope !== 'object') return
  if (envelope.event_type !== 'job.viewed') return

  const idempotencyKey = envelope.idempotency_key
  const traceId = envelope.trace_id
  const entity = envelope.entity || {}
  const payload = envelope.payload || {}
  const jobId = payload.job_id || entity.entity_id

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    // eslint-disable-next-line no-console
    console.error('job.viewed: missing idempotency_key')
    return
  }
  if (!jobId || typeof jobId !== 'string') {
    // eslint-disable-next-line no-console
    console.error('job.viewed: missing payload.job_id')
    return
  }

  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    try {
      await conn.query(
        `INSERT INTO processed_events (idempotency_key, event_type, trace_id, entity_type, entity_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          idempotencyKey.slice(0, 128),
          'job.viewed',
          (traceId || '00000000-0000-4000-8000-000000000000').slice(0, 36),
          (entity.entity_type || 'job').slice(0, 32),
          (entity.entity_id || jobId).slice(0, 36)
        ]
      )
    } catch (e) {
      await conn.rollback()
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) return
      throw e
    }

    await conn.query(
      'UPDATE job_postings SET views_count = views_count + 1 WHERE job_id = ?',
      [jobId]
    )
    await conn.commit()
  } catch (e) {
    try {
      await conn.rollback()
    } catch (_) {
      /* ignore */
    }
    throw e
  } finally {
    conn.release()
  }
}

module.exports = { handleJobViewedEnvelope }
