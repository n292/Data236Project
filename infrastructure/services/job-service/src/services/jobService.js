'use strict'

const crypto = require('crypto')
const { getPool } = require('../db/pool')
const {
  sendJobCreated,
  sendJobClosed,
  sendJobViewed,
  sendJobSaved,
  sendJobUnsaved
} = require('../kafka/jobProducer')
const {
  getSearchCache,
  setSearchCache,
  getJobCache,
  setJobCache,
  invalidateJobCache,
  invalidateAllSearchCache
} = require('../cache/redisCache')

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid (v) {
  return typeof v === 'string' && UUID_RE.test(v)
}

function isNonEmpty (v) {
  return typeof v === 'string' && v.trim().length > 0
}

// Derives a deterministic UUID-v4-shaped string from a company name so the same
// company name always maps to the same company_id without needing a companies table.
function companyIdFromName (name) {
  const hash = crypto.createHash('sha256').update(String(name).toLowerCase().trim()).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    (parseInt(hash[16], 16) % 4 + 8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
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
    company_name: row.company_name || null,
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
  if (!companyId) errors.push('company_id is required (or pass company_name)')
  else if (!isUuid(companyId)) errors.push('company_id must be a UUID')
  if (!isNonEmpty(recruiterId)) errors.push('recruiter_id is required')
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

  const companyName = body.company_name ? String(body.company_name).slice(0, 255) : null

  await pool.query(
    `INSERT INTO job_postings (
      job_id, company_id, company_name, recruiter_id, title, description, seniority_level,
      employment_type, location, industry, remote, skills_required, salary_min, salary_max,
      posted_datetime, status, views_count, applicants_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'open', 0, 0)`,
    [
      jobId,
      companyId,
      companyName,
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

  await invalidateAllSearchCache()

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
  const cached = await getJobCache(jobId)
  if (cached) return cached

  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM job_postings WHERE job_id = ? LIMIT 1', [
    jobId
  ])
  if (!rows.length) {
    const err = new Error('not_found')
    err.code = 'NOT_FOUND'
    throw err
  }
  const mapped = mapRow(rows[0])
  if (mapped.status !== 'closed') {
    await setJobCache(jobId, mapped)
  }
  return mapped
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
  if (!isNonEmpty(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id is required']
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
  await invalidateJobCache(jobId)
  await invalidateAllSearchCache()

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
  if (!isNonEmpty(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id is required']
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
  await invalidateJobCache(jobId)
  await invalidateAllSearchCache()

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
  if (!jobId || typeof jobId !== 'string') {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id is required']
    throw err
  }
  if (!userId || typeof userId !== 'string') {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['user_id is required']
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
    `INSERT INTO saved_jobs (user_id, job_id, saved_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE saved_at = NOW()`,
    [userId, jobId]
  )

  let traceId = body.trace_id
  if (traceId && !isUuid(traceId)) traceId = undefined
  if (!traceId) traceId = crypto.randomUUID()
  const sessionMeta = body.session_meta && typeof body.session_meta === 'object'
    ? body.session_meta
    : {}
  try {
    await sendJobSaved({ jobId, userId, traceId, sessionMeta })
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
    .filter((w) => w.length >= 3)  // skip words below InnoDB min token size
    .slice(0, 8)
  if (!parts.length) return null
  // AND mode: all qualifying words must appear (prefix wildcard for partial match)
  return parts.map((p) => `+${p}*`).join(' ')
}

function nonEmptyList (input) {
  if (Array.isArray(input)) {
    return input
      .map((v) => String(v).trim())
      .filter(Boolean)
  }
  if (input == null) return []
  const one = String(input).trim()
  return one ? [one] : []
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

  const cachePayload = {
    page,
    limit,
    keyword: body.keyword || null,
    location: body.location || null,
    employment_type: body.employment_type || null,
    remote: body.remote || null,
    industry: body.industry || null,
    seniority_level: body.seniority_level || null,
    company: body.company || null
  }
  const cached = await getSearchCache(cachePayload)
  if (cached) return cached

  const pool = getPool()
  const where = ["status = 'open'"]
  const params = []

  const kw = body.keyword != null ? String(body.keyword).trim() : ''
  const kwParts = kw ? String(kw).trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[^\w]/g, '')).filter(Boolean) : []
  const longWords = kwParts.filter((w) => w.length >= 3)
  const shortWords = kwParts.filter((w) => w.length > 0 && w.length < 3)
  const boolQuery = longWords.length ? longWords.slice(0, 8).map((p) => `+${p}*`).join(' ') : null
  let orderBy = 'posted_datetime DESC'
  if (kw) {
    const likePct = `%${kw}%`
    if (boolQuery) {
      // FULLTEXT AND mode for all long words (>= 3 chars), exact phrase fallback on title/company
      where.push(`(title LIKE ? OR company_name LIKE ? OR MATCH(title, description, company_name) AGAINST (? IN BOOLEAN MODE))`)
      params.push(likePct, likePct, boolQuery)
      // Short words (e.g. "AI", "UX") can't go in FULLTEXT — require them via LIKE on key fields
      for (const sw of shortWords.slice(0, 4)) {
        const swPct = `%${sw}%`
        where.push(`(title LIKE ? OR skills_required LIKE ? OR description LIKE ?)`)
        params.push(swPct, swPct, swPct)
      }
      orderBy = `(title LIKE ?) DESC, MATCH(title, description, company_name) AGAINST (? IN BOOLEAN MODE) DESC, posted_datetime DESC`
    } else {
      // All words < 3 chars (e.g. "AI", "UX") — LIKE only
      where.push(`(title LIKE ? OR company_name LIKE ? OR description LIKE ?)`)
      params.push(likePct, likePct, likePct)
      orderBy = `(title LIKE ?) DESC, posted_datetime DESC`
    }
  }

  if (body.company != null && String(body.company).trim() !== '') {
    where.push('company_name LIKE ?')
    params.push(`%${String(body.company).trim()}%`)
  }

  if (body.location != null && String(body.location).trim() !== '') {
    where.push('location LIKE ?')
    params.push(`%${String(body.location).trim()}%`)
  }
  const employmentTypes = nonEmptyList(body.employment_type).slice(0, 10)
  if (employmentTypes.length) {
    where.push(`LOWER(employment_type) IN (${employmentTypes.map(() => 'LOWER(?)').join(', ')})`)
    params.push(...employmentTypes)
  }
  const remoteModes = nonEmptyList(body.remote).slice(0, 10)
  if (remoteModes.length) {
    const normalized = remoteModes.map((v) => normalizeRemote(v))
    if (normalized.some((v) => v == null)) {
      const err = new Error('validation_error')
      err.code = 'VALIDATION'
      err.details = ['remote must be onsite, remote, or hybrid']
      throw err
    }
    where.push(`remote IN (${normalized.map(() => '?').join(', ')})`)
    params.push(...normalized)
  }
  const industryList = nonEmptyList(body.industry).slice(0, 20)
  if (industryList.length) {
    where.push(`industry IN (${industryList.map(() => '?').join(', ')})`)
    params.push(...industryList)
  }
  if (body.days_since != null) {
    const days = Math.abs(parseInt(body.days_since, 10))
    if (!isNaN(days) && days > 0) {
      where.push('posted_datetime >= DATE_SUB(NOW(), INTERVAL ? DAY)')
      params.push(days)
    }
  }
  const seniorityLevels = nonEmptyList(body.seniority_level).slice(0, 10)
  if (seniorityLevels.length) {
    where.push(`LOWER(seniority_level) IN (${seniorityLevels.map(() => 'LOWER(?)').join(', ')})`)
    params.push(...seniorityLevels)
  }

  const whereSql = where.length ? where.join(' AND ') : '1=1'
  const offset = (page - 1) * limit

  const countSql = `SELECT COUNT(*) AS c FROM job_postings WHERE ${whereSql}`
  const [countRows] = await pool.query(countSql, [...params])
  const total = countRows[0].c

  // ORDER BY may reference the keyword params again (for LIKE/MATCH scoring)
  let orderParams = []
  if (kw) {
    const likePct = `%${kw}%`
    if (boolQuery) {
      orderParams = [likePct, boolQuery]
    } else {
      orderParams = [likePct]
    }
  }

  const listSql = `SELECT * FROM job_postings WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  const [listRows] = await pool.query(listSql, [...params, ...orderParams, limit, offset])

  const result = {
    jobs: listRows.map(mapRow),
    total,
    page
  }
  await setSearchCache(cachePayload, result)
  return result
}

async function jobsByRecruiter (body) {
  const recruiterId = body.recruiter_id
  if (!isNonEmpty(recruiterId)) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['recruiter_id is required']
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

async function unsaveJob (body) {
  const jobId = body.job_id
  const userId = body.user_id
  if (!jobId || !userId) {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['job_id and user_id are required']
    throw err
  }
  const pool = getPool()
  await pool.query('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [userId, jobId])
  const traceId = crypto.randomUUID()
  try {
    await sendJobUnsaved({ jobId, userId, traceId })
  } catch { /* non-fatal */ }
  return { status: 'unsaved' }
}

async function getSavedJobs (body) {
  const userId = body.user_id
  if (!userId || typeof userId !== 'string') {
    const err = new Error('validation_error')
    err.code = 'VALIDATION'
    err.details = ['user_id is required']
    throw err
  }
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT jp.* FROM job_postings jp
     INNER JOIN saved_jobs sj ON jp.job_id = sj.job_id
     WHERE sj.user_id = ?
     ORDER BY sj.saved_at DESC`,
    [userId]
  )
  return { jobs: rows.map(mapRow) }
}

module.exports = {
  isUuid,
  companyIdFromName,
  createJob,
  getJob,
  updateJob,
  closeJob,
  viewJob,
  saveJob,
  unsaveJob,
  getSavedJobs,
  searchJobs,
  jobsByRecruiter,
  mapRow
}
