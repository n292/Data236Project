'use strict'

const { Kafka } = require('kafkajs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

function brokersFromEnv () {
  return (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main () {
  const brokers = brokersFromEnv()
  if (!brokers.length) {
    throw new Error('Set KAFKA_BROKERS in .env before running verification')
  }

  const watchSeconds = Number(process.env.W5_VERIFY_WINDOW_SECONDS || 20)
  const topics = [
    process.env.KAFKA_TOPIC_JOB_CREATED || 'job.created',
    process.env.KAFKA_TOPIC_JOB_VIEWED || 'job.viewed',
    process.env.KAFKA_TOPIC_JOB_SAVED || 'job.saved',
    process.env.KAFKA_TOPIC_JOB_CLOSED || 'job.closed'
  ]

  const kafka = new Kafka({
    clientId: `job-service-analytics-verify-${Date.now()}`,
    brokers
  })
  const consumer = kafka.consumer({
    groupId: `job-service-analytics-verify-${Date.now()}`
  })

  const counts = Object.fromEntries(topics.map((t) => [t, 0]))
  const samples = {}
  let invalidEnvelopeCount = 0

  await consumer.connect()
  for (const topic of topics) {
    // eslint-disable-next-line no-await-in-loop
    await consumer.subscribe({ topic, fromBeginning: false })
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const raw = message.value && message.value.toString()
      if (!raw) return
      counts[topic] = (counts[topic] || 0) + 1
      try {
        const env = JSON.parse(raw)
        const valid =
          env &&
          typeof env.event_type === 'string' &&
          typeof env.trace_id === 'string' &&
          env.entity &&
          typeof env.entity.entity_type === 'string' &&
          typeof env.entity.entity_id === 'string' &&
          env.payload &&
          typeof env.payload === 'object'
        if (!valid) invalidEnvelopeCount += 1
        if (!samples[topic]) samples[topic] = env
      } catch {
        invalidEnvelopeCount += 1
      }
    }
  })

  await new Promise((resolve) => setTimeout(resolve, watchSeconds * 1000))
  await consumer.stop()
  await consumer.disconnect()

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  // eslint-disable-next-line no-console
  console.log('--- Analytics Verification ---')
  // eslint-disable-next-line no-console
  console.log(`Window: ${watchSeconds}s`)
  // eslint-disable-next-line no-console
  console.log(`Total events observed: ${total}`)
  for (const topic of topics) {
    // eslint-disable-next-line no-console
    console.log(`${topic}: ${counts[topic] || 0}`)
  }
  // eslint-disable-next-line no-console
  console.log(`Invalid envelopes: ${invalidEnvelopeCount}`)
  for (const topic of topics) {
    if (samples[topic]) {
      // eslint-disable-next-line no-console
      console.log(`${topic} sample trace_id: ${samples[topic].trace_id}`)
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Verification failed:', e.message)
  process.exit(1)
})
