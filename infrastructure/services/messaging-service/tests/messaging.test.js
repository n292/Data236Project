const request = require('supertest')
const express = require('express')

jest.mock('../config/db', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../config/kafka', () => ({
  connectProducer: jest.fn().mockResolvedValue(undefined),
  disconnectProducer: jest.fn().mockResolvedValue(undefined),
  produceMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../models/Thread', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  prototype: { save: jest.fn() },
}))

jest.mock('../models/Message', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  prototype: { save: jest.fn() },
}))

const Thread = require('../models/Thread')
const Message = require('../models/Message')
const threadRoutes = require('../routes/threads')
const messageRoutes = require('../routes/messages')

const app = express()
app.use(express.json())
app.use('/api/messaging/threads', threadRoutes)
app.use('/api/messaging/messages', messageRoutes)

const MOCK_THREAD = {
  thread_id: 'T001',
  participants: [{ user_id: 'M001', name: 'Alice', role: 'member' }],
  created_at: new Date(),
  last_message_at: new Date(),
  message_count: 0,
  toObject: function () { return this },
}

const MOCK_MESSAGE = {
  message_id: 'MSG001',
  thread_id: 'T001',
  sender_id: 'M001',
  sender_name: 'Alice',
  message_text: 'Hello!',
  timestamp: new Date(),
  status: 'sent',
  toObject: function () { return this },
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/messaging/threads/open', () => {
  it('returns existing thread when one exists', async () => {
    Thread.findOne.mockResolvedValue(MOCK_THREAD)
    const res = await request(app)
      .post('/api/messaging/threads/open')
      .send({ participant_ids: ['M001', 'M002'] })
    expect(res.statusCode).toBe(200)
    expect(res.body.thread_id).toBe('T001')
  })

  it('requires participant_ids', async () => {
    const res = await request(app)
      .post('/api/messaging/threads/open')
      .send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/messaging/threads/byUser', () => {
  it('returns threads for a user', async () => {
    Thread.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([MOCK_THREAD]) })
    const res = await request(app)
      .post('/api/messaging/threads/byUser')
      .send({ user_id: 'M001' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body.threads)).toBe(true)
  })

  it('requires user_id', async () => {
    const res = await request(app)
      .post('/api/messaging/threads/byUser')
      .send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/messaging/messages/list', () => {
  it('returns messages for a thread', async () => {
    Thread.findOne.mockResolvedValue(MOCK_THREAD)
    Message.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([MOCK_MESSAGE]) })
    const res = await request(app)
      .post('/api/messaging/messages/list')
      .send({ thread_id: 'T001' })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body.messages)).toBe(true)
  })
})

describe('POST /api/messaging/messages/send - idempotency', () => {
  it('returns existing message for duplicate idempotency_key', async () => {
    Message.findOne.mockResolvedValue(MOCK_MESSAGE)
    const res = await request(app)
      .post('/api/messaging/messages/send')
      .send({
        thread_id: 'T001',
        sender_id: 'M001',
        sender_name: 'Alice',
        message_text: 'Hello!',
        idempotency_key: 'key-123',
      })
    expect(res.statusCode).toBe(200)
  })
})
