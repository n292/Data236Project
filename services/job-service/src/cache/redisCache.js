'use strict'

const crypto = require('crypto')
const { createClient } = require('redis')

let client
let ready = false
let connecting = false

const SEARCH_KEY_SET = 'cache:jobs:search:keys'

function isEnabled () {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
}

function ttlSearchSeconds () {
  const n = Number(process.env.REDIS_TTL_SEARCH_SECONDS)
  return Number.isInteger(n) && n > 0 ? n : 60
}

function ttlGetSeconds () {
  const n = Number(process.env.REDIS_TTL_GET_SECONDS)
  return Number.isInteger(n) && n > 0 ? n : 10
}

function redisUrl () {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  const host = process.env.REDIS_HOST || '127.0.0.1'
  const port = Number(process.env.REDIS_PORT) || 6379
  return `redis://${host}:${port}`
}

async function getClient () {
  if (!isEnabled()) return null
  if (client && ready) return client
  if (connecting) return null

  connecting = true
  try {
    if (!client) {
      client = createClient({ url: redisUrl() })
      client.on('error', () => {
        ready = false
      })
    }
    if (!client.isOpen) await client.connect()
    ready = true
    return client
  } catch {
    ready = false
    return null
  } finally {
    connecting = false
  }
}

function hashPayload (payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function searchKey (payload) {
  return `cache:jobs:search:${hashPayload(payload)}`
}

function getJobKey (jobId) {
  return `cache:jobs:get:${jobId}`
}

async function getJson (key) {
  const c = await getClient()
  if (!c) return null
  try {
    const raw = await c.get(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function setJson (key, value, ttlSeconds) {
  const c = await getClient()
  if (!c) return false
  try {
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds })
    return true
  } catch {
    return false
  }
}

async function getSearchCache (payload) {
  return getJson(searchKey(payload))
}

async function setSearchCache (payload, result) {
  const c = await getClient()
  if (!c) return false
  const key = searchKey(payload)
  try {
    await c.set(key, JSON.stringify(result), { EX: ttlSearchSeconds() })
    await c.sAdd(SEARCH_KEY_SET, key)
    return true
  } catch {
    return false
  }
}

async function getJobCache (jobId) {
  return getJson(getJobKey(jobId))
}

async function setJobCache (jobId, result) {
  return setJson(getJobKey(jobId), result, ttlGetSeconds())
}

async function invalidateJobCache (jobId) {
  const c = await getClient()
  if (!c) return
  try {
    await c.del(getJobKey(jobId))
  } catch {
    // ignore
  }
}

async function invalidateAllSearchCache () {
  const c = await getClient()
  if (!c) return
  try {
    const keys = await c.sMembers(SEARCH_KEY_SET)
    if (keys.length) await c.del(keys)
    await c.del(SEARCH_KEY_SET)
  } catch {
    // ignore
  }
}

async function disconnectCache () {
  if (!client) return
  try {
    if (client.isOpen) await client.quit()
  } catch {
    // ignore
  } finally {
    ready = false
    client = null
  }
}

module.exports = {
  getSearchCache,
  setSearchCache,
  getJobCache,
  setJobCache,
  invalidateJobCache,
  invalidateAllSearchCache,
  disconnectCache
}
