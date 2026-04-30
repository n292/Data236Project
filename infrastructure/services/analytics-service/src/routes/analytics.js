'use strict'

const express = require('express')
const router = express.Router()
const { getDb } = require('../db/mongo')
const { eventBus } = require('../kafka/consumer')

// ── POST /events/ingest — manual ingestion for testing ───────────────────────
router.post('/events/ingest', async (req, res) => {
  try {
    const event = req.body
    if (!event || !event.event_type) return res.status(400).json({ error: 'event_type is required' })
    const db = getDb()
    await db.collection('events').insertOne({
      ...event,
      _topic: event.event_type,
      _ingested_at: new Date(),
    })
    res.status(201).json({ success: true })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Duplicate event' })
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/jobs/top — top 10 jobs by applications per month ──────────
// ?month=2025-04  (optional — if omitted returns all-time)
router.get('/analytics/jobs/top', async (req, res) => {
  try {
    const db = getDb()
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)
    const month = req.query.month // e.g. "2025-04"

    const matchStage = { $match: { event_type: 'application.submitted' } }
    if (month) {
      matchStage.$match.timestamp = {
        $gte: `${month}-01`,
        $lt: `${month}-32`,
      }
    }

    const rows = await db.collection('events').aggregate([
      matchStage,
      {
        $group: {
          _id: {
            job_id: '$payload.job_id',
            month: { $substr: ['$timestamp', 0, 7] },
          },
          applications: { $sum: 1 },
        },
      },
      { $sort: { applications: -1 } },
      { $limit: limit },
      {
        $project: {
          job_id: '$_id.job_id',
          month: '$_id.month',
          applications: 1,
          _id: 0,
        },
      },
    ]).toArray()
    res.json({ jobs: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/jobs/low-traction — top 5 jobs with fewest applications ──
router.get('/analytics/jobs/low-traction', async (req, res) => {
  try {
    const db = getDb()
    const limit = Math.min(parseInt(req.query.limit) || 5, 20)
    const rows = await db.collection('events').aggregate([
      { $match: { event_type: 'application.submitted' } },
      { $group: { _id: '$payload.job_id', count: { $sum: 1 } } },
      { $sort: { count: 1 } },
      { $limit: limit },
      { $project: { job_id: '$_id', applications: '$count', _id: 0 } },
    ]).toArray()
    res.json({ jobs: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/jobs/clicks?job_id= — clicks (views) per job ─────────────
router.get('/analytics/jobs/clicks', async (req, res) => {
  try {
    const db = getDb()
    const { job_id } = req.query
    const match = { event_type: 'job.viewed' }
    if (job_id) match['payload.job_id'] = job_id

    const rows = await db.collection('events').aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            job_id: '$payload.job_id',
            date: { $substr: ['$timestamp', 0, 10] },
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
      { $project: { job_id: '$_id.job_id', date: '$_id.date', clicks: 1, _id: 0 } },
    ]).toArray()
    res.json({ clicks: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/jobs/saves — saved jobs per day/week ──────────────────────
// ?granularity=day|week  (default: day)
router.get('/analytics/jobs/saves', async (req, res) => {
  try {
    const db = getDb()
    const { job_id, granularity = 'day' } = req.query
    const match = { event_type: 'job.saved' }
    if (job_id) match['payload.job_id'] = job_id

    const dateExpr = granularity === 'week'
      ? { $substr: ['$timestamp', 0, 7] }  // YYYY-MM (weekly enough for demo)
      : { $substr: ['$timestamp', 0, 10] }  // YYYY-MM-DD

    const rows = await db.collection('events').aggregate([
      { $match: match },
      { $group: { _id: dateExpr, saves: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { period: '$_id', saves: 1, _id: 0 } },
    ]).toArray()
    res.json({ saves: rows, granularity })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/jobs/applications-by-city?job_id= — city-wise apps/month ─
router.get('/analytics/jobs/applications-by-city', async (req, res) => {
  try {
    const db = getDb()
    const { job_id } = req.query
    if (!job_id) return res.status(400).json({ error: 'job_id is required' })

    // Join application events with job.created to get location
    const rows = await db.collection('events').aggregate([
      { $match: { event_type: 'application.submitted', 'payload.job_id': job_id } },
      {
        $lookup: {
          from: 'events',
          let: { jid: '$payload.job_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$event_type', 'job.created'] },
              { $eq: ['$payload.job_id', '$$jid'] },
            ]}}},
            { $limit: 1 },
          ],
          as: 'job_info',
        },
      },
      {
        $addFields: {
          city: { $ifNull: [{ $arrayElemAt: ['$job_info.payload.location', 0] }, 'Unknown'] },
          month: { $substr: ['$timestamp', 0, 7] },
        },
      },
      { $group: { _id: { city: '$city', month: '$month' }, applications: { $sum: 1 } } },
      { $sort: { '_id.month': 1, applications: -1 } },
      { $project: { city: '$_id.city', month: '$_id.month', applications: 1, _id: 0 } },
    ]).toArray()
    res.json({ job_id, applications_by_city: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/funnel — view→save→apply-start→submit pipeline ────────────
// ?job_id=  (optional — scoped to one job)
router.get('/analytics/funnel', async (req, res) => {
  try {
    const db = getDb()
    const { job_id } = req.query
    const jobFilter = job_id ? { 'payload.job_id': job_id } : {}

    const [views, saves, submits, reviewed, accepted, rejected] = await Promise.all([
      db.collection('events').countDocuments({ event_type: 'job.viewed', ...jobFilter }),
      db.collection('events').countDocuments({ event_type: 'job.saved', ...jobFilter }),
      db.collection('events').countDocuments({ event_type: 'application.submitted', ...jobFilter }),
      db.collection('events').countDocuments({
        event_type: 'application.status_updated', 'payload.status': 'reviewed', ...jobFilter,
      }),
      db.collection('events').countDocuments({
        event_type: 'application.status_updated', 'payload.status': 'accepted', ...jobFilter,
      }),
      db.collection('events').countDocuments({
        event_type: 'application.status_updated', 'payload.status': 'rejected', ...jobFilter,
      }),
    ])

    const funnel = [
      { stage: 'view',     count: views },
      { stage: 'save',     count: saves },
      { stage: 'submit',   count: submits },
      { stage: 'reviewed', count: reviewed },
      { stage: 'accepted', count: accepted },
      { stage: 'rejected', count: rejected },
    ]

    res.json({ funnel, job_id: job_id || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/geo — job postings by city ────────────────────────────────
router.get('/analytics/geo', async (req, res) => {
  try {
    const db = getDb()
    const rows = await db.collection('events').aggregate([
      { $match: { event_type: 'job.created' } },
      { $group: { _id: '$payload.location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $project: { location: '$_id', count: 1, _id: 0 } },
    ]).toArray()
    res.json({ locations: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/member/dashboard?member_id= ───────────────────────────────
router.get('/analytics/member/dashboard', async (req, res) => {
  try {
    const { member_id } = req.query
    if (!member_id) return res.status(400).json({ error: 'member_id is required' })
    const db = getDb()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [viewsRaw, appStatus, connectionCount] = await Promise.all([
      db.collection('events').aggregate([
        {
          $match: {
            event_type: 'profile.viewed',
            'payload.profile_id': member_id,
            timestamp: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: { $substr: ['$timestamp', 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', views: '$count', _id: 0 } },
      ]).toArray(),

      db.collection('events').aggregate([
        { $match: { event_type: 'application.submitted', 'payload.member_id': member_id } },
        {
          $group: {
            _id: { $ifNull: ['$payload.status', 'submitted'] },
            count: { $sum: 1 },
          },
        },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]).toArray(),

      db.collection('events').countDocuments({
        event_type: 'connection.accepted',
        $or: [{ 'payload.requester_id': member_id }, { 'payload.receiver_id': member_id }],
      }),
    ])

    res.json({ profile_views: viewsRaw, application_status: appStatus, connection_count: connectionCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /analytics/recruiter/dashboard?recruiter_id= ─────────────────────────
router.get('/analytics/recruiter/dashboard', async (req, res) => {
  try {
    const { recruiter_id } = req.query
    if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id is required' })
    const db = getDb()

    // Get job IDs posted by this recruiter
    const jobEvents = await db.collection('events')
      .find({ event_type: 'job.created', 'payload.recruiter_id': recruiter_id }, { projection: { 'payload.job_id': 1, _id: 0 } })
      .toArray()
    const recruiterJobIds = [...new Set(jobEvents.map(e => e.payload.job_id).filter(Boolean))]

    const [topJobs, lowTraction, jobViews, jobSaves, funnel] = await Promise.all([
      // 1. Top 10 jobs by applications per month
      db.collection('events').aggregate([
        { $match: { event_type: 'application.submitted', 'payload.job_id': { $in: recruiterJobIds } } },
        {
          $group: {
            _id: { job_id: '$payload.job_id', month: { $substr: ['$timestamp', 0, 7] } },
            applications: { $sum: 1 },
          },
        },
        { $sort: { applications: -1 } },
        { $limit: 10 },
        { $project: { job_id: '$_id.job_id', month: '$_id.month', applications: 1, _id: 0 } },
      ]).toArray(),

      // 2. Top 5 low-traction jobs
      db.collection('events').aggregate([
        { $match: { event_type: 'application.submitted', 'payload.job_id': { $in: recruiterJobIds } } },
        { $group: { _id: '$payload.job_id', count: { $sum: 1 } } },
        { $sort: { count: 1 } },
        { $limit: 5 },
        { $project: { job_id: '$_id', applications: '$count', _id: 0 } },
      ]).toArray(),

      // 3. Clicks (views) per job per day
      db.collection('events').aggregate([
        { $match: { event_type: 'job.viewed', 'payload.job_id': { $in: recruiterJobIds } } },
        {
          $group: {
            _id: { date: { $substr: ['$timestamp', 0, 10] }, job_id: '$payload.job_id' },
            views: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
        { $project: { date: '$_id.date', job_id: '$_id.job_id', views: 1, _id: 0 } },
      ]).toArray(),

      // 4. Saved jobs per day
      db.collection('events').aggregate([
        { $match: { event_type: 'job.saved', 'payload.job_id': { $in: recruiterJobIds } } },
        { $group: { _id: { $substr: ['$timestamp', 0, 10] }, saves: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', saves: 1, _id: 0 } },
      ]).toArray(),

      // 5. Application funnel for recruiter's jobs
      Promise.all([
        db.collection('events').countDocuments({ event_type: 'job.viewed',           'payload.job_id': { $in: recruiterJobIds } }),
        db.collection('events').countDocuments({ event_type: 'job.saved',            'payload.job_id': { $in: recruiterJobIds } }),
        db.collection('events').countDocuments({ event_type: 'application.submitted', 'payload.job_id': { $in: recruiterJobIds } }),
        db.collection('events').countDocuments({ event_type: 'application.status_updated', 'payload.status': 'reviewed', 'payload.job_id': { $in: recruiterJobIds } }),
        db.collection('events').countDocuments({ event_type: 'application.status_updated', 'payload.status': 'accepted', 'payload.job_id': { $in: recruiterJobIds } }),
      ]).then(([v, s, sub, rev, acc]) => [
        { stage: 'view',     count: v },
        { stage: 'save',     count: s },
        { stage: 'submit',   count: sub },
        { stage: 'reviewed', count: rev },
        { stage: 'accepted', count: acc },
      ]),
    ])

    res.json({ top_jobs: topJobs, low_traction: lowTraction, job_views: jobViews, job_saves: jobSaves, funnel })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /recruiter/live-feed/:recruiter_id — SSE real-time event stream ───────
router.get('/recruiter/live-feed/:recruiter_id', (req, res) => {
  const { recruiter_id } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send a heartbeat every 15s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 15000)

  const RELEVANT = new Set([
    'application.submitted', 'application.status_updated',
    'job.viewed', 'job.saved', 'job.created', 'job.closed',
    'ai.results',
  ])

  const onEvent = ({ topic, event }) => {
    if (!RELEVANT.has(topic)) return
    const data = JSON.stringify({ topic, event, ts: new Date().toISOString() })
    res.write(`event: update\ndata: ${data}\n\n`)
  }

  // Listen on both global bus and recruiter-specific channel
  eventBus.on('event', onEvent)
  eventBus.on(`recruiter:${recruiter_id}`, onEvent)

  req.on('close', () => {
    clearInterval(heartbeat)
    eventBus.off('event', onEvent)
    eventBus.off(`recruiter:${recruiter_id}`, onEvent)
  })
})

// ── GET /analytics/events — paginated raw event log ──────────────────────────
router.get('/analytics/events', async (req, res) => {
  try {
    const db = getDb()
    const limit = Math.min(parseInt(req.query.limit) || 50, 500)
    const skip = parseInt(req.query.skip) || 0
    const filter = req.query.event_type ? { event_type: req.query.event_type } : {}
    const events = await db.collection('events')
      .find(filter, { projection: { _id: 0 } })
      .sort({ _ingested_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    const total = await db.collection('events').countDocuments(filter)
    res.json({ events, total, limit, skip })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
