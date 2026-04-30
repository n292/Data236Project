'use strict'

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { connect } = require('./db/mongo')
const { startConsumer } = require('./kafka/consumer')
const analyticsRouter = require('./routes/analytics')

const PORT = process.env.PORT || 4000

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'analytics-service' }))
app.use('/', analyticsRouter)

app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

async function main() {
  await connect()
  app.listen(PORT, () => console.log(`Analytics service running on port ${PORT}`))
  startConsumer().catch(e => console.error('Kafka consumer error (will retry):', e.message))
}

main().catch(e => { console.error(e); process.exit(1) })
