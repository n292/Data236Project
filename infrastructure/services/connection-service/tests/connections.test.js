const request = require('supertest')
const express = require('express')

jest.mock('../config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(),
}))

jest.mock('../config/kafka', () => ({
  connectProducer: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}))

const { getPool } = require('../config/db')
const connectionRoutes = require('../routes/connections')

const app = express()
app.use(express.json())
app.use('/api/connections', connectionRoutes)

const mockPool = {
  execute: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  getPool.mockReturnValue(mockPool)
})

const MOCK_CONNECTION = {
  connection_id: 'CON001',
  requester_id: 'M001',
  receiver_id: 'M002',
  status: 'pending',
  created_at: new Date().toISOString(),
}

describe('POST /api/connections/request', () => {
  it('sends a connection request successfully', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[]])                          // no existing connection
      .mockResolvedValueOnce([{ affectedRows: 1 }])         // insert
    const res = await request(app)
      .post('/api/connections/request')
      .send({ requester_id: 'M001', receiver_id: 'M002' })
    expect(res.statusCode).toBe(201)
    expect(res.body.success).toBe(true)
  })

  it('prevents duplicate pending request', async () => {
    mockPool.execute.mockResolvedValueOnce([[MOCK_CONNECTION]])
    const res = await request(app)
      .post('/api/connections/request')
      .send({ requester_id: 'M001', receiver_id: 'M002' })
    expect(res.statusCode).toBe(409)
  })

  it('requires both requester_id and receiver_id', async () => {
    const res = await request(app)
      .post('/api/connections/request')
      .send({ requester_id: 'M001' })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/connections/accept', () => {
  it('accepts a pending connection', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[{ ...MOCK_CONNECTION, status: 'pending' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await request(app)
      .post('/api/connections/accept')
      .send({ connection_id: 'CON001' })
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 for unknown connection', async () => {
    mockPool.execute.mockResolvedValueOnce([[]])
    const res = await request(app)
      .post('/api/connections/accept')
      .send({ connection_id: 'nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/connections/reject', () => {
  it('rejects a pending connection', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[{ ...MOCK_CONNECTION, status: 'pending' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await request(app)
      .post('/api/connections/reject')
      .send({ connection_id: 'CON001' })
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('POST /api/connections/list', () => {
  it('lists connections for a user', async () => {
    mockPool.execute.mockResolvedValue([[MOCK_CONNECTION]])
    const res = await request(app)
      .post('/api/connections/list')
      .send({ user_id: 'M001' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body.connections)).toBe(true)
  })

  it('requires user_id', async () => {
    const res = await request(app)
      .post('/api/connections/list')
      .send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/connections/mutual', () => {
  it('returns mutual connections between two users', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[{ requester_id: 'M001', receiver_id: 'M003', status: 'accepted' }]])
      .mockResolvedValueOnce([[{ requester_id: 'M002', receiver_id: 'M003', status: 'accepted' }]])
    const res = await request(app)
      .post('/api/connections/mutual')
      .send({ user_id_1: 'M001', user_id_2: 'M002' })
    expect(res.statusCode).toBe(200)
  })
})
