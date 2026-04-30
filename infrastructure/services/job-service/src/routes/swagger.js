'use strict'

const express = require('express')
const path = require('path')
const fs = require('fs')
const swaggerUi = require('swagger-ui-express')

const specPath = path.join(__dirname, '..', '..', 'docs', 'openapi.json')
const openapi = JSON.parse(fs.readFileSync(specPath, 'utf8'))

const router = express.Router()

router.get('/openapi.json', (_req, res) => {
  res.json(openapi)
})

router.use(
  '/',
  ...swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Job Service API'
  })
)

module.exports = router
