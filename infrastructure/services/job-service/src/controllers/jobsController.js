'use strict'

const jobService = require('../services/jobService')

async function create (req, res, next) {
  try {
    const raw = req.body || {}
    const traceId = req.get('x-trace-id') || raw.trace_id
    const body = { ...raw }
    delete body.trace_id

    // Inject recruiter_id from authenticated JWT — never trust the request body for this
    body.recruiter_id = req.user?.member_id || req.user?.sub || body.recruiter_id

    // Accept company_name: derive a stable UUID and keep the name for display
    if (body.company_name) {
      if (!body.company_id) body.company_id = jobService.companyIdFromName(body.company_name)
      // company_name is passed through to the service for storage
    }

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

async function view (req, res, next) {
  try {
    const out = await jobService.viewJob(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function save (req, res, next) {
  try {
    const out = await jobService.saveJob(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

async function unsave (req, res, next) {
  try {
    const out = await jobService.unsaveJob(req.body || {})
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

async function savedByUser (req, res, next) {
  try {
    const out = await jobService.getSavedJobs(req.body || {})
    res.json(out)
  } catch (e) {
    next(e)
  }
}

module.exports = { create, get, update, close, search, view, save, unsave, savedByUser, byRecruiter }
