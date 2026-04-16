'use strict'

const { Kafka } = require('kafkajs')
const { handleApplicationSubmittedEnvelope } = require('./applicationSubmittedHandler')

let consumerSingleton = null
let running = false
let runPromise = null

function brokerList () {
  return (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function startApplicationSubmittedConsumer () {
  const brokers = brokerList()
  if (!brokers.length) {
    // eslint-disable-next-line no-console
    console.error('Kafka consumer skipped: set KAFKA_BROKERS')
    return
  }
  if (running) return

  const kafka = new Kafka({
    clientId: (process.env.KAFKA_CLIENT_ID || 'job-service') + '-consumer',
    brokers
  })

  const groupId =
    process.env.KAFKA_GROUP_APPLICATION_SUBMITTED ||
    'job-service-application-submitted'
  const topic =
    process.env.KAFKA_TOPIC_APPLICATION_SUBMITTED || 'application.submitted'

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
        console.error('application.submitted: invalid JSON')
        return
      }
      try {
        await handleApplicationSubmittedEnvelope(env)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('application.submitted handler error:', e.message)
        throw e
      }
    }
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Kafka consumer run loop error:', e)
  })
}

async function disconnectConsumer () {
  if (consumerSingleton) {
    try {
      await consumerSingleton.stop()
    } catch (_) {
      /* ignore */
    }
    try {
      if (runPromise) await runPromise
    } catch (_) {
      /* ignore */
    }
    try {
      await consumerSingleton.disconnect()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Kafka consumer disconnect:', e.message)
    }
    consumerSingleton = null
  }
  running = false
  runPromise = null
}

module.exports = {
  startApplicationSubmittedConsumer,
  disconnectConsumer
}
