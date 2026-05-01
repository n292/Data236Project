import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import JobDetailPanel from '../components/JobDetailPanel'
import EasyApplyModal from '../components/EasyApplyModal'
import { useAuth } from '../context/AuthContext'
import { submitApplication, getApplicationsByMember, withdrawApplication } from '../api/applicationApi'

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, body }
}

function mapJob(raw) {
  if (!raw) return null
  const desc = raw.description || 'No description provided.'
  const looksHtml = /<[a-z][\s\S]*>/i.test(desc)
  return {
    job_id:          raw.job_id,
    title:           raw.title,
    company:         raw.company_name || 'Unknown company',
    location:        raw.location || 'Unknown',
    postedAt:        raw.posted_datetime || null,
    viewsCount:      Number(raw.views_count || 0),
    applicantsCount: Number(raw.applicants_count || 0),
    description:     looksHtml ? '' : desc,
    descriptionHtml: looksHtml ? desc : null,
    employmentType:  raw.employment_type || 'Full-time',
    seniorityLevel:  raw.seniority_level || null,
    remote:          raw.remote || 'onsite',
    skills:          Array.isArray(raw.skills_required) ? raw.skills_required : [],
    industry:        raw.industry || null,
    status:          raw.status || 'open',
    easyApply:       true,
  }
}

export default function JobDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [applying, setApplying] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [notice, setNotice] = useState('')
  const [existingApplication, setExistingApplication] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchJob() {
      setLoading(true)
      setError('')
      try {
        const { ok, body } = await postJson('/api/v1/jobs/get', { job_id: id })
        const raw = body.job || (body.job_id ? body : null)
        if (!ok || !raw) throw new Error('Job not found')
        if (!cancelled) setJob(mapJob(raw))
      } catch {
        if (!cancelled) setError('Could not load job. It may have been removed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchJob()
    return () => { cancelled = true }
  }, [id])

  // Check if member already applied to this job
  useEffect(() => {
    const memberId = user?.member_id
    if (!memberId || !id) return
    getApplicationsByMember(memberId)
      .then(apps => {
        const list = Array.isArray(apps) ? apps : (apps?.applications || [])
        const match = list.find(a => a.job_id === id)
        setExistingApplication(match || null)
      })
      .catch(() => {})
  }, [id, user?.member_id])

  // Check if job is saved
  useEffect(() => {
    const memberId = user?.member_id
    if (!memberId || !id) return
    const token = localStorage.getItem('token')
    fetch('/api/v1/jobs/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ user_id: memberId }),
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.jobs)) setSaved(d.jobs.some(j => j.job_id === id))
      })
      .catch(() => {})
  }, [id, user?.member_id])

  async function toggleSave() {
    const memberId = user?.member_id
    if (!memberId) { setNotice('Sign in to save jobs.'); return }
    const token = localStorage.getItem('token')
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    if (saved) {
      setSaved(false)
      await fetch('/api/v1/jobs/unsave', {
        method: 'POST', headers,
        body: JSON.stringify({ job_id: id, user_id: memberId }),
      }).catch(() => {})
      return
    }
    const res = await fetch('/api/v1/jobs/save', {
      method: 'POST', headers,
      body: JSON.stringify({ job_id: id, user_id: memberId }),
    })
    if (res.ok) {
      setSaved(true)
      setNotice('Job saved.')
      setTimeout(() => setNotice(''), 2000)
    }
  }

  async function handleWithdraw() {
    const memberId = user?.member_id
    if (!existingApplication || !memberId) return
    setWithdrawing(true)
    try {
      await withdrawApplication(existingApplication.application_id, memberId)
      setExistingApplication(prev => ({ ...prev, status: 'withdrawn' }))
      setNotice('Application withdrawn. You can now reapply.')
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setNotice(e.message || 'Could not withdraw application.')
    } finally {
      setWithdrawing(false)
    }
  }

  async function handleModalSubmit(payload) {
    setApplying(true)
    try {
      const result = await submitApplication(payload)
      setExistingApplication(result.application || { job_id: id, member_id: user?.member_id, status: 'submitted' })
      setNotice('Application submitted!')
      setShowModal(false)
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setNotice(e.message || 'Apply failed — please try again.')
    } finally {
      setApplying(false)
    }
  }

  async function handleModalSave(payload) {
    try {
      await submitApplication(payload)
      setNotice('Draft saved.')
      setTimeout(() => setNotice(''), 3000)
    } catch {}
  }

  const isJobClosed = job?.status === 'closed'

  return (
    <main style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#0a66c2', fontWeight: 600, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, padding: 0,
        }}
      >
        ← Back
      </button>

      {notice && (
        <div style={{
          background: notice.includes('withdrawn') || notice.includes('Draft') ? '#fff3e0' : '#e8f7ec',
          color: notice.includes('withdrawn') ? '#b24020' : '#057642',
          borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontWeight: 600, fontSize: 14,
        }}>
          {notice}
        </div>
      )}

      {isJobClosed && !loading && job && (
        <div style={{
          background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12, color: '#721c24', fontSize: 14, fontWeight: 600,
        }}>
          This position is no longer accepting applications.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: '#666', padding: 60, fontSize: 15 }}>
          Loading job details…
        </div>
      )}

      {!loading && error && (
        <div style={{ textAlign: 'center', color: '#b24020', padding: 60, fontSize: 15 }}>
          {error}
        </div>
      )}

      {!loading && job && (
        <JobDetailPanel
          job={job}
          saved={saved}
          onToggleSave={toggleSave}
          onApply={() => {
            if (!user?.member_id) { setNotice('Sign in to apply.'); return }
            setShowModal(true)
          }}
          applying={applying}
          isJobClosed={isJobClosed}
          existingApplication={existingApplication}
          onWithdraw={handleWithdraw}
          withdrawing={withdrawing}
        />
      )}

      {showModal && job && (
        <EasyApplyModal
          job={job}
          user={user}
          onClose={() => setShowModal(false)}
          onSubmit={handleModalSubmit}
          onSave={handleModalSave}
        />
      )}
    </main>
  )
}
