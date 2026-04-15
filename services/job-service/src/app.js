'use strict'

const express = require('express')
const healthRouter = require('./routes/health')
const jobsRouter = require('./routes/jobs')
const swaggerRouter = require('./routes/swagger')
const { jobErrorHandler } = require('./middleware/jobErrorHandler')

const app = express()
app.use(express.json())
app.use('/health', healthRouter)
app.use('/api/docs', swaggerRouter)
app.use('/api/v1/jobs', jobsRouter)
app.use(jobErrorHandler)

module.exports = app
