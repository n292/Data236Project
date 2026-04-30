'use strict'

const { Kafka } = require('kafkajs')
const { EventEmitter } = require('events')
const { getDb } = require('../db/mongo')

const TOPICS = [
  'job.created', 'job.closed', 'job.viewed', 'job.saved',
  'member.created', 'member.updated', 'profile.viewed',
  'application.submitted', 'application.status_updated',
  'connection.requested', 'connection.accepted',
  'message.sent',
  'ai.requests', 'ai.results',
]

// In-process bus for SSE live feeds
const eventBus = new EventEmitter()
eventBus.setMaxListeners(200)

let kafka = null
let consumer = null

async function startConsumer() {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
  kafka = new Kafka({
    clientId: 'analytics-service',
    brokers,
    retry: { retries: 10, initialRetryTime: 300 },
  })

  consumer = kafka.consumer({ groupId: 'analytics-service-consumer' })
  await consumer.connect()
  await consumer.subscribe({ topics: TOPICS, fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value.toString())
        const db = getDb()

        const key = event.idempotency_key || null
        if (key) {
          const exists = await db.collection('events').findOne({ idempotency_key: key })
          if (exists) return
        }

        await db.collection('events').insertOne({
          ...event,
          _topic: topic,
          _ingested_at: new Date(),
        })

        // Broadcast to SSE subscribers
        eventBus.emit('event', { topic, event })
        if (event.payload && event.payload.recruiter_id) {
          eventBus.emit(`recruiter:${event.payload.recruiter_id}`, { topic, event })
        }
      } catch (e) {
        if (e.code !== 11000) {
          console.error('Analytics consumer error:', e.message)
        }
      }
    },
  })

  console.log('Analytics Kafka consumer started, topics:', TOPICS.join(', '))
}

async function stopConsumer() {
  if (consumer) await consumer.disconnect()
}

module.exports = { startConsumer, stopConsumer, eventBus }
