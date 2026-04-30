require('dotenv').config()
const { consumer } = require('../config/kafka')
const applicationModel = require('../models/applicationModel')
const pool = require('../config/db')

async function ensureIdempotencyTable () {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS processed_events (
      idempotency_key VARCHAR(255) PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function isProcessed (key) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM processed_events WHERE idempotency_key = ? LIMIT 1',
    [key]
  )
  return rows.length > 0
}

async function markProcessed (key) {
  await pool.execute(
    'INSERT IGNORE INTO processed_events (idempotency_key) VALUES (?)',
    [key]
  )
}

async function startConsumer () {
  await ensureIdempotencyTable()
  await consumer.connect()
  await consumer.subscribe({ topic: 'application.submitted', fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString())
      const key = event.idempotency_key

      if (!key) {
        console.warn('[consumer] Event missing idempotency_key, skipping')
        return
      }

      if (await isProcessed(key)) {
        console.log(`[consumer] Skipping duplicate event: ${key}`)
        return
      }

      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        await applicationModel.createApplicationConn(conn, event.payload)
        await conn.execute(
          'INSERT IGNORE INTO processed_events (idempotency_key) VALUES (?)',
          [key]
        )
        await conn.commit()
        console.log(`[consumer] Saved application: ${key}`)
      } catch (err) {
        await conn.rollback()
        if (err.code === 'ER_DUP_ENTRY') {
          await markProcessed(key)
          console.log(`[consumer] Duplicate in DB, marking processed: ${key}`)
        } else {
          console.error('[consumer] Failed, rolled back:', err.message)
          throw err
        }
      } finally {
        conn.release()
      }
    }
  })
}

module.exports = { startConsumer }
