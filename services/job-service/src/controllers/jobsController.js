'use strict'

const jobService = require('../services/jobService')

async function create (req, res, next) {
  try {
    const raw = req.body || {}
    const traceId = req.get('x-trace-id') || raw.trace_id
    const body = { ...raw }
    delete body.trace_id
    const out = await jobService.createJob(body, { traceId })
    res.status(201).json(out)
  } catch (e) {
    next(e)
  }
}

async function get (req, res, next) {
  try {
    const out = await jobService.getJob(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function update (req, res, next) {
  try {
    const out = await jobService.updateJob(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function close (req, res, next) {
  try {
    const out = await jobService.closeJob(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function search (req, res, next) {
  try {
    const out = await jobService.searchJobs(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function byRecruiter (req, res, next) {
  try {
    const out = await jobService.jobsByRecruiter(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

module.exports = { create, get, update, close, search, byRecruiter }
