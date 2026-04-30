import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const REMOTE_OPTIONS = ['onsite', 'remote', 'hybrid']
const SENIORITY_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']

function toTitleCase (value) {
  return value.toLowerCase().split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

export default function RecruiterJobNewPage () {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    title: '',
    description: '',
    company_name: '',
    location: '',
    employment_type: 'FULL_TIME',
    remote: 'onsite',
    seniority_level: 'Entry',
    salary_min: '',
    salary_max: '',
  })
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState([])
  const [errors, setErrors] = useState([])
  const [submitState, setSubmitState] = useState({ loading: false, success: '', error: '' })

  const canSubmit = useMemo(() => !submitState.loading, [submitState.loading])

  function setField (key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  function addSkill () {
    const skill = skillInput.trim()
    if (!skill || skills.includes(skill)) { setSkillInput(''); return }
    setSkills(prev => [...prev, skill])
    setSkillInput('')
  }

  function validate () {
    const errs = []
    if (!form.title.trim()) errs.push('Title is required.')
    if (!form.company_name.trim()) errs.push('Company name is required.')
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
    setSubmitState({ loading: false, success: '', error: '' })
    if (!validate()) return

    const token = localStorage.getItem('token')
    try {
      setSubmitState({ loading: true, success: '', error: '' })
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        company_name: form.company_name.trim(),
        location: form.location.trim(),
        employment_type: form.employment_type,
        remote: form.remote,
        seniority_level: form.seniority_level,
        skills_required: skills,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
      }
      const res = await fetch('/api/v1/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(body.details) ? body.details.join(' ') : body.error || 'Create failed.'
        throw new Error(msg)
      }
      setSubmitState({ loading: false, success: body.job_id, error: '' })
      setErrors([])
    } catch (err) {
      setSubmitState({ loading: false, success: '', error: err.message || 'Create failed.' })
    }
  }

  const inputCls = { width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #CACCCE', borderRadius: 4, boxSizing: 'border-box', fontFamily: 'inherit' }
  const labelCls = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.9)' }

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '28px 32px' }}>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(0,0,0,0.9)', margin: '0 0 4px' }}>Create Job Posting</h1>
        {user && (
          <p style={{ fontSize: 13, color: '#56687A', margin: '0 0 24px' }}>
            Posting as <strong>{user.first_name} {user.last_name}</strong> · {user.email}
          </p>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <label style={labelCls}>
            Job Title *
            <input style={inputCls} value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Senior Backend Engineer" />
          </label>

          <label style={labelCls}>
            Description
            <textarea style={{ ...inputCls, resize: 'vertical', minHeight: 120 }} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Role details, responsibilities, qualifications…" rows={5} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelCls}>
              Company Name *
              <input style={inputCls} value={form.company_name} onChange={e => setField('company_name', e.target.value)} placeholder="e.g. Acme Corp" />
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

          {errors.length > 0 && (
            <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
              {errors.map(e => <div key={e}>{e}</div>)}
            </div>
          )}

          {submitState.success && (
            <div style={{ background: '#f0faf0', border: '1px solid #86c986', color: '#1a5e1a', borderRadius: 4, padding: '12px 16px', fontSize: 14 }}>
              Job posted successfully!{' '}
              <button type="button" onClick={() => navigate('/recruiter/jobs')}
                style={{ background: 'none', border: 'none', color: '#0A66C2', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}>
                View my jobs
              </button>
            </div>
          )}

          {submitState.error && (
            <div style={{ background: '#fff4f4', border: '1px solid #efb8b8', color: '#8a1c1c', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
              {submitState.error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit}
            style={{ background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 999, padding: '13px', fontSize: 16, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.7, marginTop: 4 }}>
            {submitState.loading ? 'Posting…' : 'Post Job'}
          </button>
        </form>
      </div>
    </div>
  )
}
