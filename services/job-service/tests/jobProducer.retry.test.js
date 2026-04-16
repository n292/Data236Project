'use strict'

describe('jobProducer retry behavior', () => {
  let sendMock
  let connectMock
  let disconnectMock
  let KafkaMock

  beforeEach(() => {
    jest.resetModules()
    sendMock = jest.fn()
    connectMock = jest.fn().mockResolvedValue(undefined)
    disconnectMock = jest.fn().mockResolvedValue(undefined)

    KafkaMock = jest.fn(() => ({
      producer: jest.fn(() => ({
        connect: connectMock,
        send: sendMock,
        disconnect: disconnectMock
      }))
    }))

    jest.doMock('kafkajs', () => ({ Kafka: KafkaMock }))
    process.env.KAFKA_BROKERS = '127.0.0.1:9092'
    process.env.KAFKA_CLIENT_ID = 'job-service-test'
    process.env.KAFKA_TOPIC_JOB_CREATED = 'job.created'
  })

  afterEach(async () => {
    const producer = require('../src/kafka/jobProducer')
    await producer.disconnectProducer()
    jest.dontMock('kafkajs')
  })

  it('retries producer.send and succeeds on third attempt', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('temporary fail 1'))
      .mockRejectedValueOnce(new Error('temporary fail 2'))
      .mockResolvedValueOnce(undefined)

    const producer = require('../src/kafka/jobProducer')
    await producer.sendJobCreated({
      jobId: '10000000-0000-4000-8000-000000000099',
      title: 'Retry Test Job',
      companyId: '10000000-0000-4000-8000-000000000001',
      recruiterId: '10000000-0000-4000-8000-000000000002',
      location: 'SF',
      employmentType: 'FULL_TIME',
      traceId: '20000000-0000-4000-8000-000000000003'
    })

    expect(sendMock).toHaveBeenCalledTimes(3)
  })

  it('throws after retry budget is exhausted', async () => {
    sendMock.mockRejectedValue(new Error('persistent fail'))

    const producer = require('../src/kafka/jobProducer')
    await expect(
      producer.sendJobCreated({
        jobId: '10000000-0000-4000-8000-000000000099',
        title: 'Retry Test Job',
        companyId: '10000000-0000-4000-8000-000000000001',
        recruiterId: '10000000-0000-4000-8000-000000000002',
        location: 'SF',
        employmentType: 'FULL_TIME',
        traceId: '20000000-0000-4000-8000-000000000003'
      })
    ).rejects.toThrow('persistent fail')

    expect(sendMock).toHaveBeenCalledTimes(3)
  })
})
