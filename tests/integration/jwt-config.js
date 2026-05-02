'use strict'

/**
 * Single source for HS256 secret — must match docker-compose SECRET_KEY / JWT_* on services.
 */
function getJwtSecret() {
  return (
    process.env.JWT_SECRET ||
    process.env.SECRET_KEY ||
    'changeme-replace-with-32-char-random-string'
  )
}

module.exports = { getJwtSecret }
