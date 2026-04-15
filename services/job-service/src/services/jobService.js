'use strict'

const crypto = require('crypto')
const { getPool } = require('../db/pool')
const {
  sendJobCreated,
  sendJobClosed,
  sendJobViewed,
  sendJobSaved
} = require('../kafka/jobProducer')

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid (v) {
  return typeof v === 'string' && UUID_RE.test(v)
}

function parseJsonArray (skills) {
  if (skills == null) return []
  if (Array.isArray(skills)) return skills
  if (typeof skills === 'string') {
    try {
      const p = JSON.parse(skills)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

function mapRow (row) {
  if (!row) return null
  let skills = row.skills_required
  if (typeof skills === 'string') {
    try {
      skills = JSON.parse(skills)
    } catch {
      skills = []
    }
  }
  if (!Array.isArray(skills)) skills = []

  return {
    job_id: row.job_id,
    company_id: row.company_id,
    recruiter_id: row.recruiter_id,
    title: row.title,
    description: row.description,
    seniority_level: row.seniority_level,
    employment_type: row.employment_type,
    location: row.location,
    industry: row.industry ?? null,
    remote: row.remote,
    skills_required: skills,
    salary_range:
      row.salary_min != null || row.salary_max != null
        ? { min: row.salary_min, max: row.salary_max }
        : null,
    posted_datetime: row.posted_datetime,
    status: row.status,
    views_count: row.views_count,
    applicants_count: row.applicants_count
  }
}

function normalizeRemote (v) {
  if (v == null) return 'onsite'
  const s = String(v).toLowerCase()
  if (s === 'remote' || s === 'hybrid' || s === 'onsite') return s
  return null
}

function normalizeSalaryRange (body) {
  let min = body.salary_min
  let max = body.salary_max
  const range = body.salary_range
  if (range && typeof range === 'object') {
    if (range.min != null) min = range.min
    if (range.max != null) max = range.max
  }
  const nMin = min != null && min !== '' ? Number(min) : null
  const nMax = max != null && max !== '' ? Number(max) : null
  return {
    min: Number.isFinite(nMin) ? nMin : null,
    max: Number.isFinite(nMax) ? nMax : null
  }
}

/**
 * @param {import('express').Request['body']} body
 * @param {{ traceId?: string }} [meta]
 */
async function createJob (body, meta = {}) {
  const title = (body.title || '').trim()
  const companyId = body.company_id
  const recruiterId = body.recruiter_id
  const location = (body.location || '').trim()
  const employmentType = (body.employment_type || '').trim()

  const errors = []
  if (!title) errors.push('title is required')
  if (!companyId) errors.push('company_id is required')
  else if (!isUuid(companyId)) errors.push('company_id must be a UUID')
  if (!recruiterId) errors.push('recruiter_id is required')
  else if (!isUuid(recruiterId)) errors.push('recruiter_id must be a UUID')
  if (!location) errors.push('location is required')
  if (!employmentType) errors.push('employment_type is required')

  const remote = normalizeRemote(body.remote)
  if (body.remote != null && remote === null) {
    errors.push('remote must be onsite, remote, or hybrid')
  }

  if (errors.length) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = errors
    throw err
  }

  const pool = getPool()
  const [dup] = await pool.query(
    `SELECT job_id FROM job_postings
     WHERE title = ? AND company_id = ? AND recruiter_id = ? AND status = 'open' LIMIT 1`,
    [title, companyId, recruiterId]
  )
  if (dup.length) {
    const err = new Error('duplicate_job')
    err.code = 'DUPLICATE_JOB'
    throw err
  }

  const jobId = crypto.randomUUID()
  const { min: salaryMin, max: salaryMax } = normalizeSalaryRange(body)
  const skillsJson = JSON.stringify(parseJsonArray(body.skills_required))
  const seniority = body.seniority_level != null ? String(body.seniority_level).slice(0, 64) : null
  const description = body.description != null ? String(body.description) : null
  const industry =
    body.industry != null ? String(body.industry).slice(0, 128) : null

  await pool.query(
    `INSERT INTO job_postings (
      job_id, company_id, recruiter_id, title, description, seniority_level,
      employment_type, location, industry, remote, skills_required, salary_min, salary_max,
      posted_datetime, status, views_count, applicants_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'open', 0, 0)`,
    [
      jobId,
      companyId,
      recruiterId,
      title.slice(0, 255),
      description,
      seniority,
      employmentType.slice(0, 64),
      location.slice(0, 255),
      industry,
      remote,
      skillsJson,
      salaryMin,
      salaryMax
    ]
  )

  let traceId = meta.traceId
  if (traceId && !isUuid(traceId)) traceId = undefined
  if (!traceId) traceId = crypto.randomUUID()

  try {
    await sendJobCreated({
      jobId,
      title: title.slice(0, 255),
      companyId,
      recruiterId,
      location: location.slice(0, 255),
      employmentType: employmentType.slice(0, 64),
      traceId
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('job.created Kafka produce failed (job row committed):', e.message)
  }

  return { job_id: jobId, status: 'open' }
}

async function getJob (body) {
  const jobId = body.job_id
  if (!jobId || !isUuid(jobId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id must be a UUID']
    throw err
  }
  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM job_postings WHERE job_id = ? LIMIT 1', [
    jobId
  ])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }
  return mapRow(rows[0])
}

async function updateJob (body) {
  const jobId = body.job_id
  const recruiterId = body.recruiter_id
  if (!jobId || !isUuid(jobId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id must be a UUID']
    throw err
  }
  if (!recruiterId || !isUuid(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id must be a UUID']
    throw err
  }

  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM job_postings WHERE job_id = ? LIMIT 1', [
    jobId
  ])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }
  const current = rows[0]
  if (current.recruiter_id !== recruiterId) {
    const err = new Error('forbidden')
    err.code = 'FORBIDDEN'
    throw err
  }

  const source = body.fields_to_update && typeof body.fields_to_update === 'object'
    ? body.fields_to_update
    : body

  const sets = []
  const params = []

  if (source.title !== undefined && source.title !== current.title) {
    sets.push('title = ?')
    params.push(String(source.title).trim().slice(0, 255))
  }
  if (source.description !== undefined && source.description !== current.description) {
    sets.push('description = ?')
    params.push(source.description == null ? null : String(source.description))
  }
  if (
    source.seniority_level !== undefined &&
    source.seniority_level !== current.seniority_level
  ) {
    sets.push('seniority_level = ?')
    params.push(
      source.seniority_level == null ? null : String(source.seniority_level).slice(0, 64)
    )
  }
  if (
    source.employment_type !== undefined &&
    source.employment_type !== current.employment_type
  ) {
    sets.push('employment_type = ?')
    params.push(String(source.employment_type).slice(0, 64))
  }
  if (source.location !== undefined && source.location !== current.location) {
    sets.push('location = ?')
    params.push(String(source.location).trim().slice(0, 255))
  }
  if (source.industry !== undefined && source.industry !== current.industry) {
    sets.push('industry = ?')
    params.push(source.industry == null ? null : String(source.industry).slice(0, 128))
  }
  if (source.remote !== undefined) {
    const nr = normalizeRemote(source.remote)
    if (nr === null) {
      const err = new Error('validation_error')
      err.code = 'VALIDATION'
      err.details = ['remote must be onsite, remote, or hybrid']
      throw err
    }
    if (nr !== current.remote) {
      sets.push('remote = ?')
      params.push(nr)
    }
  }
  if (source.skills_required !== undefined) {
    const next = JSON.stringify(parseJsonArray(source.skills_required))
    const cur =
      typeof current.skills_required === 'string'
        ? current.skills_required
        : JSON.stringify(current.skills_required || [])
    if (next !== cur) {
      sets.push('skills_required = ?')
      params.push(next)
    }
  }

  const nextSal = normalizeSalaryRange({ ...body, ...source })
  const curMin =
    current.salary_min != null && current.salary_min !== ''
      ? Number(current.salary_min)
      : null
  const curMax =
    current.salary_max != null && current.salary_max !== ''
      ? Number(current.salary_max)
      : null
  if (source.salary_range !== undefined || source.salary_min !== undefined || source.salary_max !== undefined) {
    if (nextSal.min !== curMin) {
      sets.push('salary_min = ?')
      params.push(nextSal.min)
    }
    if (nextSal.max !== curMax) {
      sets.push('salary_max = ?')
      params.push(nextSal.max)
    }
  }

  if (!sets.length) {
    return mapRow(current)
  }

  params.push(jobId)
  await pool.query(`UPDATE job_postings SET ${sets.join(', ')} WHERE job_id = ?`, params)

  const [after] = await pool.query('SELECT * FROM job_postings WHERE job_id = ? LIMIT 1', [
    jobId
  ])
  return mapRow(after[0])
}

async function closeJob (body) {
  const jobId = body.job_id
  const recruiterId = body.recruiter_id
  if (!jobId || !isUuid(jobId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id must be a UUID']
    throw err
  }
  if (!recruiterId || !isUuid(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id must be a UUID']
    throw err
  }

  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM job_postings WHERE job_id = ? LIMIT 1', [
    jobId
  ])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }
  const row = rows[0]
  if (row.recruiter_id !== recruiterId) {
    const err = new Error('forbidden')
    err.code = 'FORBIDDEN'
    throw err
  }
  if (row.status === 'closed') {
    const err = new Error('already_closed')
    err.code = 'ALREADY_CLOSED'
    throw err
  }

  await pool.query(
    "UPDATE job_postings SET status = 'closed' WHERE job_id = ? AND recruiter_id = ?",
    [jobId, recruiterId]
  )

  let traceId = body.trace_id
  if (traceId && !isUuid(traceId)) traceId = undefined
  if (!traceId) traceId = crypto.randomUUID()
  try {
    await sendJobClosed({
      jobId,
      recruiterId,
      companyId: row.company_id,
      traceId
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('job.closed Kafka produce failed:', e.message)
  }

  return { status: 'closed' }
}

async function viewJob (body) {
  const jobId = body.job_id
  const viewerId = body.viewer_id
  if (!jobId || !isUuid(jobId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id must be a UUID']
    throw err
  }
  if (!viewerId || !isUuid(viewerId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['viewer_id must be a UUID']
    throw err
  }

  const pool = getPool()
  const [rows] = await pool.query('SELECT job_id FROM job_postings WHERE job_id = ? LIMIT 1', [jobId])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }

  await pool.query(
    'UPDATE job_postings SET views_count = views_count + 1 WHERE job_id = ?',
    [jobId]
  )

  let traceId = body.trace_id
  if (traceId && !isUuid(traceId)) traceId = undefined
  if (!traceId) traceId = crypto.randomUUID()
  try {
    await sendJobViewed({ jobId, viewerId, traceId })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('job.viewed Kafka produce failed:', e.message)
  }

  return { status: 'viewed' }
}

async function saveJob (body) {
  const jobId = body.job_id
  const userId = body.user_id
  if (!jobId || !isUuid(jobId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id must be a UUID']
    throw err
  }
  if (!userId || !isUuid(userId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['user_id must be a UUID']
    throw err
  }

  const pool = getPool()
  const [rows] = await pool.query('SELECT job_id FROM job_postings WHERE job_id = ? LIMIT 1', [jobId])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }

  let traceId = body.trace_id
  if (traceId && !isUuid(traceId)) traceId = undefined
  if (!traceId) traceId = crypto.randomUUID()
  try {
    await sendJobSaved({ jobId, userId, traceId })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('job.saved Kafka produce failed:', e.message)
  }

  return { status: 'saved' }
}

function booleanMatchQuery (keyword) {
  const parts = String(keyword)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\w]/g, ''))
    .filter(Boolean)
    .slice(0, 8)
  if (!parts.length) return null
  return parts.map((p) => `+${p}*`).join(' ')
}

async function searchJobs (body) {
  const page = Number(body.page)
  const limit = Number(body.limit)
  if (!Number.isInteger(page) || page < 1) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['page must be a positive integer']
    throw err
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['limit must be an integer between 1 and 100']
    throw err
  }

  const pool = getPool()
  const where = []
  const params = []

  const kw = body.keyword != null ? String(body.keyword).trim() : ''
  const boolQuery = kw ? booleanMatchQuery(kw) : null
  if (boolQuery) {
    where.push('MATCH(title, description) AGAINST (? IN BOOLEAN MODE)')
    params.push(boolQuery)
  }

  if (body.location != null && String(body.location).trim() !== '') {
    where.push('location LIKE ?')
    params.push(`%${String(body.location).trim()}%`)
  }
  if (body.employment_type != null && String(body.employment_type).trim() !== '') {
    where.push('LOWER(employment_type) = LOWER(?)')
    params.push(String(body.employment_type).trim())
  }
  if (body.remote != null && String(body.remote).trim() !== '') {
    const r = normalizeRemote(body.remote)
    if (r === null) {
      const err = new Error('validation_error')
      err.code = 'VALIDATION'
      err.details = ['remote must be onsite, remote, or hybrid']
      throw err
    }
    where.push('remote = ?')
    params.push(r)
  }
  if (body.industry != null && String(body.industry).trim() !== '') {
    where.push('industry = ?')
    params.push(String(body.industry).trim().slice(0, 128))
  }

  const whereSql = where.length ? where.join(' AND ') : '1=1'
  const offset = (page - 1) * limit

  const countSql = `SELECT COUNT(*) AS c FROM job_postings WHERE ${whereSql}`
  const [countRows] = await pool.query(countSql, [...params])
  const total = countRows[0].c

  const listSql = `SELECT * FROM job_postings WHERE ${whereSql} ORDER BY posted_datetime DESC LIMIT ? OFFSET ?`
  const [listRows] = await pool.query(listSql, [...params, limit, offset])

  return {
    jobs: listRows.map(mapRow),
    total,
    page
  }
}

async function jobsByRecruiter (body) {
  const recruiterId = body.recruiter_id
  if (!recruiterId || !isUuid(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id must be a UUID']
    throw err
  }

  const page = body.page != null ? Number(body.page) : 1
  const limit = body.limit != null ? Number(body.limit) : 20
  if (!Number.isInteger(page) || page < 1) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['page must be a positive integer']
    throw err
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['limit must be an integer between 1 and 100']
    throw err
  }

  const pool = getPool()
  const params = [recruiterId]
  let statusClause = ''
  if (body.status != null && String(body.status).trim() !== '') {
    const s = String(body.status).trim().toLowerCase()
    if (s !== 'open' && s !== 'closed') {
      const err = new Error('validation_error')
      err.code = 'VALIDATION'
      err.details = ['status must be open or closed']
      throw err
    }
    statusClause = ' AND status = ?'
    params.push(s)
  }

  const whereSql = `recruiter_id = ?${statusClause}`
  const offset = (page - 1) * limit

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM job_postings WHERE ${whereSql}`,
    params
  )
  const total = countRows[0].c

  const [listRows] = await pool.query(
    `SELECT * FROM job_postings WHERE ${whereSql} ORDER BY posted_datetime DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return { jobs: listRows.map(mapRow), total }
}

module.exports = {
  isUuid,
  createJob,
  getJob,
  updateJob,
  closeJob,
  viewJob,
  saveJob,
  searchJobs,
  jobsByRecruiter,
  mapRow
}
