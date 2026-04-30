'use strict'

const { MongoClient } = require('mongodb')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin_analytics'

let client = null
let db = null

async function connect() {
  if (db) return db
  client = new MongoClient(MONGODB_URI)
  await client.connect()
  db = client.db()
  await db.collection('events').createIndex({ event_type: 1, timestamp: 1 })
  await db.collection('events').createIndex({ 'payload.job_id': 1 })
  await db.collection('events').createIndex({ 'payload.member_id': 1 })
  await db.collection('events').createIndex({ 'payload.profile_id': 1 })
  await db.collection('events').createIndex({ idempotency_key: 1 }, { unique: true, sparse: true })
  console.log('Analytics MongoDB connected')
  return db
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected')
  return db
}

module.exports = { connect, getDb }
