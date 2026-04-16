'use strict'

jest.mock('../src/kafka/jobProducer', () => ({
  sendJobCreated: jest.fn().mockResolvedValue(undefined),
  sendJobClosed: jest.fn().mockResolvedValue(undefined),
  sendJobViewed: jest.fn().mockResolvedValue(undefined),
  sendJobSaved: jest.fn().mockResolvedValue(undefined),
  disconnectProducer: jest.fn().mockResolvedValue(undefined),
  getKafka: jest.fn(),
  brokerList: jest.fn(() => [])
}))

const request = require('supertest')
const app = require('../src/app')
const pool = require('../src/db/pool')
const jobProducer = require('../src/kafka/jobProducer')

describe('Edge cases: partial create failure safety', () => {
  let queryMock

  beforeEach(() => {
    queryMock = jest.fn()
    pool.setPoolForTests({ query: queryMock })
  })

  afterEach(() => {
    pool.resetPoolForTests()
    jest.clearAllMocks()
  })

  it('returns 500 and does not emit job.created when DB insert fails', async () => {
    queryMock.mockResolvedValueOnce([[], []]) // duplicate check
    queryMock.mockRejectedValueOnce(new Error('insert_failed'))

    const res = await request(app)
      .post('/api/v1/jobs/create')
      .send({
        title: 'Backend Engineer',
        company_id: '10000000-0000-4000-8000-000000000001',
        recruiter_id: '10000000-0000-4000-8000-000000000001',
        location: 'Remote',
        employment_type: 'FULL_TIME'
      })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('internal_error')
    expect(jobProducer.sendJobCreated).not.toHaveBeenCalled()
  })
})
