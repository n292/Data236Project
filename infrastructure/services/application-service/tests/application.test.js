const request = require('supertest')
const express = require('express')
const cors = require('cors')

// Mock DB pool and Kafka before requiring routes
jest.mock('../src/config/db', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
    query: jest.fn(),
  }
  return mockPool
})

jest.mock('../src/kafka/producer', () => ({
  publishApplicationSubmitted: jest.fn().mockResolvedValue(undefined),
  publishStatusUpdated: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../src/kafka/consumer', () => ({
  startConsumer: jest.fn().mockResolvedValue(undefined),
}))

const pool = require('../src/config/db')
const applicationRoutes = require('../src/routes/applicationRoutes')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/applications', applicationRoutes)

const MOCK_APP = {
  application_id: 'app-001',
  job_id: 'job-001',
  member_id: 'member-001',
  recruiter_id: 'rec-001',
  status: 'submitted',
  resume_text: 'Experienced engineer',
  cover_letter: 'Dear Hiring Manager',
  recruiter_note: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /applications/byMember', () => {
  it('returns list of applications for a member', async () => {
    pool.execute.mockResolvedValue([[MOCK_APP]])
    const res = await request(app)
      .post('/applications/byMember')
      .send({ member_id: 'member-001' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /applications/byJob', () => {
  it('returns list of applications for a job', async () => {
    pool.execute.mockResolvedValue([[MOCK_APP]])
    const res = await request(app)
      .post('/applications/byJob')
      .send({ job_id: 'job-001' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /applications/get', () => {
  it('returns a single application by id', async () => {
    pool.execute.mockResolvedValue([[MOCK_APP]])
    const res = await request(app)
      .post('/applications/get')
      .send({ application_id: 'app-001' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 when not found', async () => {
    pool.execute.mockResolvedValue([[]])
    const res = await request(app)
      .post('/applications/get')
      .send({ application_id: 'nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /applications/updateStatus', () => {
  it('updates status successfully', async () => {
    pool.execute
      .mockResolvedValueOnce([[MOCK_APP]])   // findById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
    const res = await request(app)
      .post('/applications/updateStatus')
      .send({ application_id: 'app-001', status: 'reviewed', actor_id: 'rec-001' })
    expect(res.statusCode).toBe(200)
  })

  it('rejects invalid status', async () => {
    const res = await request(app)
      .post('/applications/updateStatus')
      .send({ application_id: 'app-001', status: 'invalid_status' })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /applications/addNote', () => {
  it('adds recruiter note', async () => {
    pool.execute
      .mockResolvedValueOnce([[MOCK_APP]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await request(app)
      .post('/applications/addNote')
      .send({ application_id: 'app-001', recruiter_note: 'Strong candidate' })
    expect(res.statusCode).toBe(200)
  })
})

describe('Duplicate application prevention', () => {
  it('returns 409 when member already applied to same job', async () => {
    // isJobClosed query (returns not closed), then findDuplicate returns existing
    pool.execute
      .mockResolvedValueOnce([[{ status: 'open' }]])  // isJobClosed
      .mockResolvedValueOnce([[MOCK_APP]])              // findDuplicate
    const res = await request(app)
      .post('/applications/submit')
      .field('job_id', 'job-001')
      .field('member_id', 'member-001')
      .attach('resume', Buffer.from('%PDF-1.4 test'), { filename: 'resume.pdf', contentType: 'application/pdf' })
    expect(res.statusCode).toBe(409)
  })
})
