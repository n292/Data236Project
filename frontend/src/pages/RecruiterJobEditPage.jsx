import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const REMOTE_OPTIONS = ['onsite', 'remote', 'hybrid']
const SENIORITY_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']

function toTitleCase (value) {
  return value.toLowerCase().split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

const inputCls = {
  width: '100%', padding: '10px 12px', fontSize: 15,
  border: '1px solid #CACCCE', borderRadius: 4,
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelCls = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.9)' }

export default function RecruiterJobEditPage () {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const recruiterId = user?.member_id

  const [loadState, setLoadState] = useState({ loading: true, error: '' })
  const [job, setJob] = useState(null)

  const [form, setForm] = useState({
    title: '', description: '', location: '',
    employment_type: 'FULL_TIME', remote: 'onsite',
    seniority_level: 'Entry', salary_min: '', salary_max: '',
  })
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState([])
  const [errors, setErrors] = useState([])
  const [submitState, setSubmitState] = useState({ loading: false, success: false, error: '' })

  // Load the existing job
  useEffect(() => {
    if (!id) return
    fetch('/api/v1/jobs/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: id }),
    })
      .then(r => r.json())
      .then(data => {
        const j = data.job || data
        if (!j || !j.job_id) throw new Error('Job not found')
        setJob(j)
        const rawSkills = Array.isArray(j.skills_required) ? j.skills_required : []
        setSkills(rawSkills)
        setForm({
          title: j.title || '',
          description: j.description || '',
          location: j.location || '',
          employment_type: j.employment_type || 'FULL_TIME',
          remote: j.remote || 'onsite',
          seniority_level: j.seniority_level || 'Entry',
          salary_min: j.salary_range?.min != null ? String(j.salary_range.min) : '',
          salary_max: j.salary_range?.max != null ? String(j.salary_range.max) : '',
        })
        setLoadState({ loading: false, error: '' })
      })
      .catch(e => setLoadState({ loading: false, error: e.message || 'Could not load job.' }))
  }, [id])

  function setField (key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  function addSkill () {
    const s = skillInput.trim()
    if (!s || skills.includes(s)) { setSkillInput(''); return }
    setSkills(prev => [...prev, s])
    setSkillInput('')
  }

  function validate () {
    const errs = []
    if (!form.title.trim()) errs.push('Title is required.')
    if (!form.location.trim()) errs.push('Location is required.')
    if (form.salary_min && Number.isNaN(Number(form.salary_min))) errs.push('Salary min must be a number.')
    if (form.salary_max && Number.isNaN(Number(form.salary_max))) errs.push('Salary max must be a number.')
    if (form.salary_min && form.salary_max && Number(form.salary_min) > Number(form.salary_max)) {
      errs.push('Salary min cannot exceed salary max.')
    }
    setErrors(errs)
    return errs.length === 0
  }

  async function onSubmit (e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitState({ loading: true, success: false, error: '' })
    const token = localStorage.getItem('token')
    try {
      const payload = {
        job_id: id,
        recruiter_id: recruiterId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim(),
        employment_type: form.employment_type,
        remote: form.remote,
        seniority_level: form.seniority_level,
        skills_required: skills,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
      }
      const res = await fetch('/api/v1/jobs/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(body.details) ? body.details.join(' ') : body.error || 'Update failed.'
        throw new Error(msg)
      }
      setSubmitState({ loading: false, success: true, error: '' })
    } catch (err) {
      setSubmitState({ loading: false, success: false, error: err.message || 'Update failed.' })
    }
  }

  const canSubmit = useMemo(() => !submitState.loading, [submitState.loading])

  // ── Loading / error states ────────────────────────────────────────────────

  if (loadState.loading) {
    return (
      <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px', textAlign: 'center', color: '#56687A' }}>
        Loading job…
      </div>
    )
  }

  if (loadState.error) {
    return (
      <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 6, padding: '14px 18px' }}>
          {loadState.error}
        </div>
        <Link to="/recruiter/jobs" style={{ display: 'inline-block', marginTop: 14, color: '#0A66C2', fontWeight: 600, fontSize: 14 }}>
          ← Back to My Jobs
        </Link>
      </div>
    )
  }

  // ── Closed job guard ──────────────────────────────────────────────────────

  if (job?.status === 'closed') {
    return (
      <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '28px 32px' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>Job is Closed</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#56687A' }}>
            <strong>{job.title}</strong> is closed and cannot be edited.
          </p>
          <Link to="/recruiter/jobs"
            style={{ background: '#0A66C2', color: '#fff', padding: '10px 24px', borderRadius: 999, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← Back to My Jobs
          </Link>
        </div>
      </div>
    )
  }

  // ── Edit form ─────────────────────────────────────────────────────────────

  return (
    <div className="li-dashboard" style={{ maxWidth: 720, margin: '0 auto' }}>
      <header className="li-page-header li-page-header--compact">
        <div>
          <h1 className="li-page-header__title">Edit job</h1>
          <p className="li-page-header__subtitle">
            {job?.company_name && <><strong>{job.company_name}</strong> · </>}
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>
          </p>
        </div>
        <div className="li-page-header__actions">
          <Link to="/recruiter/jobs" className="li-btn li-btn--secondary">Manage jobs</Link>
        </div>
      </header>

      <div className="li-card" style={{ padding: '28px 32px' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <label style={labelCls}>
            Job Title *
            <input style={inputCls} value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Senior Backend Engineer" />
          </label>

          <label style={labelCls}>
            Description
            <textarea style={{ ...inputCls, resize: 'vertical', minHeight: 120 }}
              value={form.description} onChange={e => setField('description', e.target.value)}
              placeholder="Role details, responsibilities, qualifications…" rows={5} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelCls}>
              Company
              <input style={{ ...inputCls, background: '#F9F9F9', color: '#56687A' }}
                value={job?.company_name || ''} disabled
                title="Company name cannot be changed after posting" />
            </label>
            <label style={labelCls}>
              Location *
              <input style={inputCls} value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. San Francisco, CA" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label style={labelCls}>
              Employment Type
              <select style={inputCls} value={form.employment_type} onChange={e => setField('employment_type', e.target.value)}>
                {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{toTitleCase(o)}</option>)}
              </select>
            </label>
            <label style={labelCls}>
              Work Setting
              <select style={inputCls} value={form.remote} onChange={e => setField('remote', e.target.value)}>
                {REMOTE_OPTIONS.map(o => <option key={o} value={o}>{toTitleCase(o)}</option>)}
              </select>
            </label>
            <label style={labelCls}>
              Seniority Level
              <select style={inputCls} value={form.seniority_level} onChange={e => setField('seniority_level', e.target.value)}>
                {SENIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelCls}>
              Salary Min (USD)
              <input style={inputCls} value={form.salary_min} onChange={e => setField('salary_min', e.target.value)} placeholder="e.g. 120000" inputMode="numeric" />
            </label>
            <label style={labelCls}>
              Salary Max (USD)
              <input style={inputCls} value={form.salary_max} onChange={e => setField('salary_max', e.target.value)} placeholder="e.g. 160000" inputMode="numeric" />
            </label>
          </div>

          {/* Skills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.9)' }}>Skills Required</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputCls, flex: 1 }}
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                placeholder="Type a skill and press Enter or Add"
              />
              <button type="button" onClick={addSkill}
                style={{ padding: '10px 18px', background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Add
              </button>
            </div>
            {skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {skills.map(skill => (
                  <span key={skill} onClick={() => setSkills(s => s.filter(x => x !== skill))}
                    style={{ background: '#EBF3FB', color: '#0A66C2', border: '1px solid #0A66C2', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {skill} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
              {errors.map(e => <div key={e}>{e}</div>)}
            </div>
          )}

          {/* Success */}
          {submitState.success && (
            <div style={{ background: '#f0faf0', border: '1px solid #86c986', color: '#1a5e1a', borderRadius: 4, padding: '12px 16px', fontSize: 14 }}>
              Job updated successfully!{' '}
              <button type="button" onClick={() => navigate('/recruiter/jobs')}
                style={{ background: 'none', border: 'none', color: '#0A66C2', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}>
                View my jobs
              </button>
            </div>
          )}

          {/* API error */}
          {submitState.error && (
            <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
              {submitState.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={!canSubmit}
              style={{ flex: 1, background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 999, padding: '13px', fontSize: 16, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.7 }}>
              {submitState.loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => navigate('/recruiter/jobs')}
              style={{ padding: '13px 24px', borderRadius: 999, border: '1px solid #CACCCE', background: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#38434F' }}>
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
