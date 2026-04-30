'use strict'

const { buildJobCreatedEnvelope, idempotencyKeyJobCreated } = require('../src/kafka/eventEnvelope')

describe('eventEnvelope', () => {
  it('buildJobCreatedEnvelope matches team envelope shape', () => {
    const env = buildJobCreatedEnvelope({
      jobId: '10000000-0000-4000-8000-000000000099',
      title: 'T',
      companyId: '10000000-0000-4000-8000-000000000001',
      recruiterId: '10000000-0000-4000-8000-000000000002',
      location: 'SF',
      employmentType: 'FULL_TIME',
      traceId: '20000000-0000-4000-8000-000000000003'
    })
    expect(env.event_type).toBe('job.created')
    expect(env.trace_id).toBe('20000000-0000-4000-8000-000000000003')
    expect(env.actor_id).toBe('10000000-0000-4000-8000-000000000002')
    expect(env.entity).toEqual({
      entity_type: 'job',
      entity_id: '10000000-0000-4000-8000-000000000099'
    })
    expect(env.payload.job_id).toBe('10000000-0000-4000-8000-000000000099')
    expect(env.idempotency_key).toBeTruthy()
    expect(env.idempotency_key).toBe(
      idempotencyKeyJobCreated(
        '10000000-0000-4000-8000-000000000099',
        env.timestamp
      )
    )
  })
})
