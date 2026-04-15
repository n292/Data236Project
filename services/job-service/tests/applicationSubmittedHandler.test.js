'use strict'

const pool = require('../src/db/pool')
const {
  handleApplicationSubmittedEnvelope
} = require('../src/kafka/applicationSubmittedHandler')

describe('applicationSubmittedHandler', () => {
  let conn

  beforeEach(() => {
    conn = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      rollback: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    }
    pool.setPoolForTests({ getConnection: jest.fn().mockResolvedValue(conn) })
  })

  afterEach(() => {
    pool.resetPoolForTests()
  })

  const envelope = (idempotencyKey, jobId) => ({
    event_type: 'application.submitted',
    trace_id: '30000000-0000-4000-8000-000000000001',
    actor_id: 'member-1',
    entity: { entity_type: 'application', entity_id: '40000000-0000-4000-8000-000000000002' },
    payload: { job_id: jobId, member_id: '50000000-0000-4000-8000-000000000003' },
    idempotency_key: idempotencyKey
  })

  it('inserts processed_events and increments applicants', async () => {
    conn.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    await handleApplicationSubmittedEnvelope(
      envelope('key-first', '60000000-0000-4000-8000-000000000004')
    )

    expect(conn.beginTransaction).toHaveBeenCalled()
    expect(conn.query).toHaveBeenCalledTimes(2)
    expect(conn.commit).toHaveBeenCalled()
    expect(conn.rollback).not.toHaveBeenCalled()
  })

  it('skips duplicate idempotency_key', async () => {
    const dup = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })
    conn.query.mockRejectedValueOnce(dup)

    await handleApplicationSubmittedEnvelope(
      envelope('key-dup', '60000000-0000-4000-8000-000000000004')
    )

    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.commit).not.toHaveBeenCalled()
  })
})
