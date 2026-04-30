'use strict'

/**
 * Loads Kaggle (or compatible) job CSV into job_postings.
 * Usage: npm run seed  (requires .env and applied 001_create_job_postings.sql)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const mysql = require('mysql2/promise')
const { parse } = require('csv-parse/sync')

const BATCH = Number(process.env.SEED_BATCH_SIZE) || 500
const MAX_ROWS = process.env.SEED_MAX_ROWS
  ? Number(process.env.SEED_MAX_ROWS)
  : Infinity

const CSV_PATH = process.env.JOBS_CSV_PATH
  ? path.resolve(process.cwd(), process.env.JOBS_CSV_PATH)
  : path.join(__dirname, '..', 'data', 'linkedin_jobs.csv')

// Kaggle "LinkedIn Job Postings 2023" (`job_postings.csv`) uses many of these headers.
const HEADER_ALIASES = {
  title: ['title', 'job_title', 'position', 'job_title_text'],
  description: ['description', 'job_description', 'job_summary'],
  location: ['location', 'job_location', 'formatted_location'],
  employment_type: [
    'employment_type',
    'job_type',
    'formatted_employment_type',
    'formatted_work_type',
    'work_type'
  ],
  company: ['company', 'company_name', 'employer', 'company_id'],
  salary_min: ['salary_min', 'min_salary'],
  salary_max: ['salary_max', 'max_salary'],
  posted_datetime: [
    'posted_datetime',
    'posted_date',
    'created_at',
    'date_posted',
    'listed_time',
    'original_listed_time'
  ],
  seniority_level: ['seniority_level', 'formatted_experience_level', 'experience_level'],
  skills_desc: ['skills_desc', 'skills', 'skills_list'],
  remote_allowed: ['remote_allowed', 'is_remote']
}

function normalizeHeader (h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/** @returns {Record<string, string>} field -> original CSV column name */
function buildColumnMap (sampleRow) {
  const keys = Object.keys(sampleRow)
  const normalized = keys.map((k) => normalizeHeader(k))
  const map = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      const idx = normalized.indexOf(a)
      if (idx !== -1) {
        map[field] = keys[idx]
        break
      }
    }
  }
  return map
}

function uuidFromNamespace (namespace, value) {
  const ns = crypto.createHash('sha1').update(namespace + '\0' + value).digest()
  const bytes = Buffer.alloc(16)
  ns.copy(bytes, 0, 0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function inferSeniority (titleText) {
  const t = (titleText || '').toLowerCase()
  if (/\bintern\b/.test(t)) return 'Internship'
  if (/\bjunior\b|\bjr\.?\b/.test(t)) return 'Entry'
  if (/\bsenior\b|\bsr\.?\b|\blead\b|\bprincipal\b/.test(t)) return 'Mid-Senior'
  if (/\bdirector\b|\bvp\b|\bvice president\b/.test(t)) return 'Director'
  return null
}

function inferRemote (locationText, descriptionText) {
  const blob = `${locationText || ''} ${descriptionText || ''}`.toLowerCase()
  if (/\bhybrid\b/.test(blob)) return 'hybrid'
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(blob)) return 'remote'
  return 'onsite'
}

function parseSalaryObj (rec, colMap) {
  let salaryMin = colMap.salary_min ? rec[colMap.salary_min] : null
  let salaryMax = colMap.salary_max ? rec[colMap.salary_max] : null
  salaryMin = salaryMin != null && salaryMin !== '' ? Number(salaryMin) : null
  salaryMax = salaryMax != null && salaryMax !== '' ? Number(salaryMax) : null
  if (Number.isFinite(salaryMin) || Number.isFinite(salaryMax)) {
    return {
      min: Number.isFinite(salaryMin) ? salaryMin : null,
      max: Number.isFinite(salaryMax) ? salaryMax : null
    }
  }
  return { min: null, max: null }
}

function pick (rec, colMap, field, fallback = '') {
  const key = colMap[field]
  if (!key) return fallback
  const v = rec[key]
  return v != null && String(v).trim() !== '' ? String(v).trim() : fallback
}

function parsePostedAt (rec, colMap) {
  const key = colMap.posted_datetime
  if (!key) return new Date()
  const raw = rec[key]
  if (raw == null || raw === '') return new Date()
  const str = String(raw).trim()
  if (/^\d+$/.test(str)) {
    const n = Number(str)
    const ms = n > 1e12 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function buildSkillsJson (rec, colMap) {
  if (!colMap.skills_desc) return '[]'
  const t = rec[colMap.skills_desc]
  if (t == null || t === '') return '[]'
  const parts = String(t)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 200)
    .slice(0, 50)
  return JSON.stringify(parts)
}

function rowToJob (rec, colMap, index) {
  const title = pick(rec, colMap, 'title', 'Untitled role')
  const description = pick(rec, colMap, 'description', '')
  const location = pick(rec, colMap, 'location', 'Unknown')
  const employmentType = pick(rec, colMap, 'employment_type', 'FULL_TIME')
  const companyName = pick(rec, colMap, 'company', `company-row-${index}`)

  const companyId = uuidFromNamespace('company', companyName)
  const recruiterId = uuidFromNamespace('recruiter', companyId)
  const jobId = crypto.randomUUID()

  const { min: salaryMin, max: salaryMax } = parseSalaryObj(rec, colMap)
  let seniority = null
  if (colMap.seniority_level) {
    const sv = rec[colMap.seniority_level]
    if (sv != null && String(sv).trim() !== '') {
      seniority = String(sv).trim().slice(0, 64)
    }
  }
  if (!seniority) seniority = inferSeniority(title)

  let remote = inferRemote(location, description)
  if (colMap.remote_allowed) {
    const v = rec[colMap.remote_allowed]
    const s = String(v).toLowerCase()
    if (v === 1 || v === true || s === '1' || s === 'true' || s === 'yes') {
      remote = 'remote'
    }
  }

  const posted = parsePostedAt(rec, colMap)
  const skillsJson = buildSkillsJson(rec, colMap)

  return [
    jobId,
    companyId,
    recruiterId,
    title.slice(0, 255),
    description || null,
    seniority,
    employmentType.slice(0, 64),
    location.slice(0, 255),
    remote,
    skillsJson,
    salaryMin,
    salaryMax,
    posted,
    'open',
    0,
    0
  ]
}

async function main () {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    console.error('Set JOBS_CSV_PATH or place a file at data/linkedin_jobs.csv')
    process.exit(1)
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8')
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true
  })

  if (!records.length) {
    console.error('No rows in CSV')
    process.exit(1)
  }

  const colMap = buildColumnMap(records[0])
  if (!colMap.title) {
    console.error('Could not find a title column. Headers:', Object.keys(records[0]))
    process.exit(1)
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'data236',
    waitForConnections: true,
    connectionLimit: 5
  })

  const sql = `INSERT INTO job_postings (
    job_id, company_id, recruiter_id, title, description, seniority_level,
    employment_type, location, remote, skills_required, salary_min, salary_max,
    posted_datetime, status, views_count, applicants_count
  ) VALUES ?`

  let inserted = 0
  const limit = Math.min(records.length, MAX_ROWS)

  for (let i = 0; i < limit; i += BATCH) {
    const chunk = records.slice(i, Math.min(i + BATCH, limit))
    const values = chunk.map((rec, j) => rowToJob(rec, colMap, i + j))
    const [res] = await pool.query(sql, [values])
    inserted += res.affectedRows || chunk.length
    console.error(`Inserted batch ${i}–${Math.min(i + BATCH, limit)} (${inserted} rows)`)
  }

  await pool.end()
  console.error(`Done. Inserted ~${inserted} rows into job_postings.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
