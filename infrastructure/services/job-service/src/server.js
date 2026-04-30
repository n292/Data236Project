'use strict'

require('dotenv').config()
const app = require('./app')
const {
  startApplicationSubmittedConsumer,
  disconnectConsumer
} = require('./kafka/applicationSubmittedConsumer')
const {
  startJobViewedConsumer,
  disconnectJobViewedConsumer
} = require('./kafka/jobViewedConsumer')
const { disconnectProducer } = require('./kafka/jobProducer')
const { disconnectCache } = require('./cache/redisCache')

const port = Number(process.env.PORT) || 3003

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`job-service listening on ${port}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(
      `Port ${port} is already in use. Pick another (PORT=3003 npm run dev) or free it: lsof -iTCP:${port} -sTCP:LISTEN`
    )
  } else {
    // eslint-disable-next-line no-console
    console.error(err)
  }
  process.exit(1)
})

if ((process.env.KAFKA_BROKERS || '').trim()) {
  startApplicationSubmittedConsumer().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Kafka consumer failed to start:', e.message)
  })
  startJobViewedConsumer().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('job.viewed consumer failed to start:', e.message)
  })
}

async function shutdown () {
  await disconnectJobViewedConsumer()
  await disconnectConsumer()
  await disconnectProducer()
  await disconnectCache()
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => {
  shutdown().catch(() => process.exit(1))
})
process.on('SIGTERM', () => {
  shutdown().catch(() => process.exit(1))
})
