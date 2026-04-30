'use strict'

// eslint-disable-next-line no-unused-vars
function jobErrorHandler (err, _req, res, _next) {
  if (err.code === 'VALIDATION') {
    return res.status(400).json({
      error: 'validation_error',
      details: err.details || [err.message]
    })
  }
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ error: 'not_found' })
  }
  if (err.code === 'FORBIDDEN') {
    return res.status(403).json({ error: 'forbidden' })
  }
  if (err.code === 'DUPLICATE_JOB') {
    return res.status(409).json({ error: 'duplicate' })
  }
  if (err.code === 'ALREADY_CLOSED') {
    return res.status(409).json({ error: 'already_closed' })
  }

  // eslint-disable-next-line no-console
  console.error(err)
  return res.status(500).json({ error: 'internal_error' })
}

module.exports = { jobErrorHandler }
