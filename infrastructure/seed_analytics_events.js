'use strict'
/**
 * Seeds MongoDB analytics events for the 8 seeded jobs and their applications.
 * Fires: job.created, job.viewed, job.saved, application.submitted, application.status_updated
 */
const { MongoClient } = require('mongodb')
const { v4: uuidv4 } = require('uuid')

const MONGO_URI = 'mongodb://localhost:27017/linkedin_analytics'
const RECRUITER_ID = 'm_447299a83400'

const JOBS = [
  { job_id: 'job-c0c9df0e', title: 'Senior Software Engineer',    location: 'San Francisco, CA' },
  { job_id: 'job-265cb481', title: 'Frontend Engineer',            location: 'New York, NY'      },
  { job_id: 'job-687db1f6', title: 'Data Scientist',               location: 'Seattle, WA'       },
  { job_id: 'job-f59cadd8', title: 'DevOps Engineer',              location: 'Austin, TX'        },
  { job_id: 'job-e5a2e444', title: 'Product Manager',              location: 'Chicago, IL'       },
  { job_id: 'job-376bf862', title: 'Machine Learning Engineer',    location: 'Boston, MA'        },
  { job_id: 'job-66507afd', title: 'Backend Engineer (Node.js)',   location: 'Denver, CO'        },
  { job_id: 'job-311d87b3', title: 'UX/UI Designer',               location: 'Los Angeles, CA'   },
]

const MEMBER_IDS = [
  'm_aee72c551e7d', 'm_c01cc684168f', 'm_e266a89d26a4', 'm_85a0f0f5b76b',
  'm_b9b113602b68', 'm_cdb661cb50c1', 'm_30eff1518695', 'm_f0b15ec177a9',
  'm_c0af184cf664', 'm_5501ee241d83', 'm_f9d0cd120bd6', 'm_8eb3734e02dd',
  'm_2e40a7fbe12e', 'm_d6d76f2f55d2', 'm_8359ebdd3a01', 'm_c50174d41e0a',
  'm_9386b802d0c2', 'm_00563ef00848', 'm_ffdfed034f34', 'm_b095fca87d2b',
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  const db = client.db()
  const col = db.collection('events')

  const events = []

  for (const job of JOBS) {
    // job.created
    events.push({
      event_type: 'job.created',
      idempotency_key: `job-created-${job.job_id}`,
      timestamp: daysAgo(randInt(20, 30)),
      payload: {
        job_id: job.job_id,
        recruiter_id: RECRUITER_ID,
        title: job.title,
        location: job.location,
      },
      _ingested_at: new Date(),
    })

    // job.viewed — 30-150 views spread over last 20 days
    const viewCount = randInt(30, 150)
    for (let i = 0; i < viewCount; i++) {
      events.push({
        event_type: 'job.viewed',
        idempotency_key: `job-viewed-${job.job_id}-${i}`,
        timestamp: daysAgo(randInt(0, 20)),
        payload: { job_id: job.job_id, viewer_id: pick(MEMBER_IDS) },
        _ingested_at: new Date(),
      })
    }

    // job.saved — 5-25 saves
    const saveCount = randInt(5, 25)
    for (let i = 0; i < saveCount; i++) {
      events.push({
        event_type: 'job.saved',
        idempotency_key: `job-saved-${job.job_id}-${i}`,
        timestamp: daysAgo(randInt(0, 15)),
        payload: { job_id: job.job_id, user_id: pick(MEMBER_IDS) },
        _ingested_at: new Date(),
      })
    }

    // application.submitted — 3-7 per job
    const applicants = [...MEMBER_IDS].sort(() => Math.random() - 0.5).slice(0, randInt(3, 7))
    const statuses = ['submitted', 'reviewed', 'accepted', 'rejected']
    const weights  = [0.35, 0.30, 0.15, 0.20]

    for (const member_id of applicants) {
      const appDays = randInt(0, 18)
      const appId   = 'app-' + uuidv4().slice(0, 8)

      events.push({
        event_type: 'application.submitted',
        idempotency_key: `app-submitted-${appId}`,
        timestamp: daysAgo(appDays),
        payload: {
          application_id: appId,
          job_id: job.job_id,
          member_id,
          recruiter_id: RECRUITER_ID,
          status: 'submitted',
        },
        _ingested_at: new Date(),
      })

      // Status update for most applications
      if (Math.random() > 0.3) {
        const rnd = Math.random()
        let cumulative = 0
        let status = 'reviewed'
        for (let s = 0; s < statuses.length; s++) {
          cumulative += weights[s]
          if (rnd < cumulative) { status = statuses[s]; break }
        }
        if (status !== 'submitted') {
          events.push({
            event_type: 'application.status_updated',
            idempotency_key: `app-status-${appId}-${status}`,
            timestamp: daysAgo(appDays - 1),
            payload: {
              application_id: appId,
              job_id: job.job_id,
              member_id,
              recruiter_id: RECRUITER_ID,
              status,
            },
            _ingested_at: new Date(),
          })
        }
      }
    }
  }

  // Upsert (skip duplicates via idempotency_key)
  let inserted = 0
  for (const ev of events) {
    try {
      await col.insertOne(ev)
      inserted++
    } catch (e) {
      if (e.code !== 11000) console.error('insert error:', e.message)
    }
  }

  console.log(`✓ ${inserted} events seeded into MongoDB analytics`)
  await client.close()
}

main().catch(e => { console.error(e); process.exit(1) })
