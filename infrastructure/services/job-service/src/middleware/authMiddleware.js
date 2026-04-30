'use strict'

const crypto = require('crypto')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'

function verifyJwt(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts
  const data = `${headerB64}.${payloadB64}`
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
  if (expected !== signatureB64) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  const payload = verifyJwt(token)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  req.user = payload
  next()
}

function requireRole(role) {
  return [
    authenticate,
    (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({
          error: `Access denied. Required role: ${role}. Your role: ${req.user.role || 'unknown'}`,
        })
      }
      next()
    },
  ]
}

module.exports = { authenticate, requireRole }
