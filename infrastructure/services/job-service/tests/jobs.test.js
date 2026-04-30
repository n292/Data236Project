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

describe('Job API (mocked DB)', () => {
  let queryMock

  beforeEach(() => {
    queryMock = jest.fn()
    pool.setPoolForTests({ query: queryMock })
  })

  afterEach(() => {
    pool.resetPoolForTests()
    jest.clearAllMocks()
  })

  const uuid = '10000000-0000-4000-8000-000000000001'
  const otherRecruiter = '20000000-0000-4000-8000-000000000002'

  describe('POST /api/v1/jobs/create', () => {
    it('returns 400 when validation fails', async () => {
      const res = await request(app).post('/api/v1/jobs/create').send({ title: 'x' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('validation_error')
    })

    it('returns 201 with job_id on success', async () => {
      queryMock.mockResolvedValueOnce([[], []]) // duplicate check
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // insert

      const res = await request(app)
        .post('/api/v1/jobs/create')
        .send({
          title: 'Backend Engineer',
          company_id: uuid,
          recruiter_id: uuid,
          location: 'Remote',
          employment_type: 'FULL_TIME',
          remote: 'remote'
        })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('open')
      expect(res.body.job_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      expect(jobProducer.sendJobCreated).toHaveBeenCalled()
    })

    it('returns 409 on duplicate open posting', async () => {
      queryMock.mockResolvedValueOnce([[{ job_id: 'dup' }], []])

      const res = await request(app)
        .post('/api/v1/jobs/create')
        .send({
          title: 'Same',
          company_id: uuid,
          recruiter_id: uuid,
          location: 'NYC',
          employment_type: 'FULL_TIME'
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('duplicate')
    })
  })

  describe('POST /api/v1/jobs/get', () => {
    it('returns 404 when job missing', async () => {
      queryMock.mockResolvedValueOnce([[], []])
      const res = await request(app).post('/api/v1/jobs/get').send({ job_id: uuid })
      expect(res.status).toBe(404)
    })

    it('returns 200 with job payload', async () => {
      const row = {
        job_id: uuid,
        company_id: uuid,
        recruiter_id: uuid,
        title: 'T',
        description: 'D',
        seniority_level: 'Entry',
        employment_type: 'FULL_TIME',
        location: 'SF',
        industry: 'Tech',
        remote: 'hybrid',
        skills_required: '[]',
        salary_min: 100,
        salary_max: 200,
        posted_datetime: new Date('2026-01-01'),
        status: 'open',
        views_count: 1,
        applicants_count: 2
      }
      queryMock.mockResolvedValueOnce([[row], []])

      const res = await request(app).post('/api/v1/jobs/get').send({ job_id: uuid })
      expect(res.status).toBe(200)
      expect(res.body.title).toBe('T')
      expect(res.body.salary_range).toEqual({ min: 100, max: 200 })
    })
  })

  describe('POST /api/v1/jobs/update', () => {
    const baseRow = {
      job_id: uuid,
      company_id: uuid,
      recruiter_id: uuid,
      title: 'Old',
      description: 'D',
      seniority_level: null,
      employment_type: 'FULL_TIME',
      location: 'SF',
      industry: null,
      remote: 'onsite',
      skills_required: '[]',
      salary_min: null,
      salary_max: null,
      posted_datetime: new Date(),
      status: 'open',
      views_count: 0,
      applicants_count: 0
    }

    it('returns 403 when recruiter mismatch', async () => {
      queryMock.mockResolvedValueOnce([[{ ...baseRow, recruiter_id: otherRecruiter }], []])
      const res = await request(app)
        .post('/api/v1/jobs/update')
        .send({ job_id: uuid, recruiter_id: uuid, title: 'Nope' })
      expect(res.status).toBe(403)
    })

    it('returns 200 without UPDATE when no dirty fields', async () => {
      queryMock.mockResolvedValueOnce([[{ ...baseRow }], []])
      const res = await request(app)
        .post('/api/v1/jobs/update')
        .send({ job_id: uuid, recruiter_id: uuid, title: 'Old' })
      expect(res.status).toBe(200)
      expect(queryMock).toHaveBeenCalledTimes(1)
    })

    it('returns 200 and runs UPDATE when title changes', async () => {
      queryMock.mockResolvedValueOnce([[{ ...baseRow }], []])
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }, []])
      queryMock.mockResolvedValueOnce([
        [{ ...baseRow, title: 'New Title' }],
        []
      ])

      const res = await request(app)
        .post('/api/v1/jobs/update')
        .send({ job_id: uuid, recruiter_id: uuid, title: 'New Title' })

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('New Title')
      expect(queryMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('POST /api/v1/jobs/close', () => {
    const row = {
      job_id: uuid,
      company_id: uuid,
      recruiter_id: uuid,
      title: 'T',
      description: null,
      seniority_level: null,
      employment_type: 'FULL_TIME',
      location: 'SF',
      industry: null,
      remote: 'onsite',
      skills_required: '[]',
      salary_min: null,
      salary_max: null,
      posted_datetime: new Date(),
      status: 'open',
      views_count: 0,
      applicants_count: 0
    }

    it('returns 409 when already closed', async () => {
      queryMock.mockResolvedValueOnce([[{ ...row, status: 'closed' }], []])
      const res = await request(app)
        .post('/api/v1/jobs/close')
        .send({ job_id: uuid, recruiter_id: uuid })
      expect(res.status).toBe(409)
    })

    it('returns 200 and closes open job', async () => {
      queryMock.mockResolvedValueOnce([[row], []])
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }, []])
      const res = await request(app)
        .post('/api/v1/jobs/close')
        .send({ job_id: uuid, recruiter_id: uuid })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'closed' })
    })
  })

  describe('POST /api/v1/jobs/search', () => {
    it('returns 400 for invalid page', async () => {
      const res = await request(app)
        .post('/api/v1/jobs/search')
        .send({ page: 0, limit: 10 })
      expect(res.status).toBe(400)
    })

    it('returns jobs and total', async () => {
      queryMock.mockResolvedValueOnce([[{ c: 1 }], []])
      queryMock.mockResolvedValueOnce([
        [
          {
            job_id: uuid,
            company_id: uuid,
            recruiter_id: uuid,
            title: 'Hit',
            description: 'Body',
            seniority_level: null,
            employment_type: 'FULL_TIME',
            location: 'SF',
            industry: null,
            remote: 'remote',
            skills_required: '[]',
            salary_min: null,
            salary_max: null,
            posted_datetime: new Date(),
            status: 'open',
            views_count: 0,
            applicants_count: 0
          }
        ],
        []
      ])

      const res = await request(app)
        .post('/api/v1/jobs/search')
        .send({ page: 1, limit: 10, keyword: 'engineer' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.page).toBe(1)
      expect(res.body.jobs).toHaveLength(1)
    })
  })

  describe('POST /api/v1/jobs/view and /save', () => {
    it('returns 200 and emits viewed event', async () => {
      queryMock.mockResolvedValueOnce([[{ job_id: uuid }], []])
      const res = await request(app)
        .post('/api/v1/jobs/view')
        .send({ job_id: uuid, viewer_id: uuid })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'viewed' })
      expect(jobProducer.sendJobViewed).toHaveBeenCalled()
    })

    it('returns 200 and emits saved event', async () => {
      queryMock.mockResolvedValueOnce([[{ job_id: uuid }], []])
      const res = await request(app)
        .post('/api/v1/jobs/save')
        .send({ job_id: uuid, user_id: uuid })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'saved' })
      expect(jobProducer.sendJobSaved).toHaveBeenCalled()
    })
  })

  describe('POST /api/v1/jobs/byRecruiter', () => {
    it('returns 400 for bad recruiter_id', async () => {
      const res = await request(app)
        .post('/api/v1/jobs/byRecruiter')
        .send({ recruiter_id: 'not-a-uuid' })
      expect(res.status).toBe(400)
    })

    it('returns list for recruiter', async () => {
      queryMock.mockResolvedValueOnce([[{ c: 0 }], []])
      queryMock.mockResolvedValueOnce([[], []])

      const res = await request(app)
        .post('/api/v1/jobs/byRecruiter')
        .send({ recruiter_id: uuid, page: 1, limit: 10 })

      expect(res.status).toBe(200)
      expect(res.body.jobs).toEqual([])
      expect(res.body.total).toBe(0)
    })
  })
})
