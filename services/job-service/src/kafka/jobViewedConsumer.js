'use strict'

const { Kafka } = require('kafkajs')
const { handleJobViewedEnvelope } = require('./jobViewedHandler')

let consumerSingleton = null
let running = false
let runPromise = null

function brokerList () {
  return (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function startJobViewedConsumer () {
  const brokers = brokerList()
  if (!brokers.length || running) return

  const kafka = new Kafka({
    clientId: (process.env.KAFKA_CLIENT_ID || 'job-service') + '-viewed-consumer',
    brokers
  })
  const groupId = process.env.KAFKA_GROUP_JOB_VIEWED || 'job-service-job-viewed'
  const topic = process.env.KAFKA_TOPIC_JOB_VIEWED || 'job.viewed'

  consumerSingleton = kafka.consumer({ groupId })
  await consumerSingleton.connect()
  await consumerSingleton.subscribe({ topic, fromBeginning: false })
  running = true

  // eslint-disable-next-line no-console
  console.error(`Kafka consumer subscribed: ${topic} (group ${groupId})`)

  runPromise = consumerSingleton.run({
    eachMessage: async ({ message }) => {
      const raw = message.value && message.value.toString()
      if (!raw) return
      let env
      try {
        env = JSON.parse(raw)
      } catch {
        // eslint-disable-next-line no-console
        console.error('job.viewed: invalid JSON')
        return
      }
      try {
        await handleJobViewedEnvelope(env)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('job.viewed handler error:', e.message)
        throw e
      }
    }
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('job.viewed consumer run loop error:', e)
  })
}

async function disconnectJobViewedConsumer () {
  if (consumerSingleton) {
    try {
      await consumerSingleton.stop()
    } catch (_) {
      // ignore
    }
    try {
      if (runPromise) await runPromise
    } catch (_) {
      // ignore
    }
    try {
      await consumerSingleton.disconnect()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('job.viewed consumer disconnect:', e.message)
    }
    consumerSingleton = null
  }
  running = false
  runPromise = null
}

module.exports = {
  startJobViewedConsumer,
  disconnectJobViewedConsumer
}
