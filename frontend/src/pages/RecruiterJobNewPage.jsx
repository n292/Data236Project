import { useMemo, useState } from 'react'

const EMPLOYMENT_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
const REMOTE_OPTIONS = ['onsite', 'remote', 'hybrid']
const SENIORITY_OPTIONS = ['Internship', 'Entry', 'Associate', 'Mid-Senior', 'Director']

function toTitleCase (value) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function RecruiterJobNewPage () {
  const [form, setForm] = useState({
    title: '',
    description: '',
    company_id: '00000000-0000-4000-8000-000000001001',
    recruiter_id: '00000000-0000-4000-8000-000000001002',
    location: '',
    employment_type: 'FULL_TIME',
    remote: 'onsite',
    seniority_level: 'Entry',
    salary_min: '',
    salary_max: ''
  })
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState([])
  const [errors, setErrors] = useState([])
  const [submitState, setSubmitState] = useState({
    loading: false,
    success: '',
    error: ''
  })

  const canSubmit = useMemo(() => !submitState.loading, [submitState.loading])

  function setField (key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addSkillFromInput () {
    const skill = skillInput.trim()
    if (!skill) return
    if (skills.includes(skill)) {
      setSkillInput('')
      return
    }
    setSkills((prev) => [...prev, skill])
    setSkillInput('')
  }

  function removeSkill (skill) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  function validate () {
    const nextErrors = []
    if (!form.title.trim()) nextErrors.push('Title is required.')
    if (!form.company_id.trim()) nextErrors.push('Company ID is required.')
    if (!form.recruiter_id.trim()) nextErrors.push('Recruiter ID is required.')
    if (!form.location.trim()) nextErrors.push('Location is required.')
    if (!form.employment_type.trim()) nextErrors.push('Employment type is required.')
    if (form.salary_min && Number.isNaN(Number(form.salary_min))) {
      nextErrors.push('Salary min must be a valid number.')
    }
    if (form.salary_max && Number.isNaN(Number(form.salary_max))) {
      nextErrors.push('Salary max must be a valid number.')
    }
    if (form.salary_min && form.salary_max) {
      const min = Number(form.salary_min)
      const max = Number(form.salary_max)
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        nextErrors.push('Salary min cannot be greater than salary max.')
      }
    }
    setErrors(nextErrors)
    return nextErrors.length === 0
  }

  async function onSubmit (e) {
    e.preventDefault()
    setSubmitState({ loading: false, success: '', error: '' })
    if (!validate()) return

    try {
      setSubmitState({ loading: true, success: '', error: '' })
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        company_id: form.company_id.trim(),
        recruiter_id: form.recruiter_id.trim(),
        location: form.location.trim(),
        employment_type: form.employment_type,
        remote: form.remote,
        seniority_level: form.seniority_level,
        skills_required: skills,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined
      }
      const response = await fetch('/api/v1/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const details = Array.isArray(body.details) ? body.details.join(' ') : body.error || 'Create failed.'
        throw new Error(details)
      }

      setSubmitState({
        loading: false,
        success: `Job created successfully. job_id=${body.job_id}`,
        error: ''
      })
      setErrors([])
    } catch (err) {
      setSubmitState({
        loading: false,
        success: '',
        error: err.message || 'Create failed.'
      })
    }
  }

  return (
    <main className="recruiter-new-page">
      <header className="recruiter-new-page__header">
        <h1>Create Job Posting</h1>
        <p>Publish a new role with LinkedIn-style required fields and validation.</p>
      </header>

      <form className="recruiter-new-form" onSubmit={onSubmit}>
        <label>
          <span>Title *</span>
          <input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Senior Backend Engineer"
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={6}
            placeholder="Role details, responsibilities, and qualifications..."
          />
        </label>

        <div className="recruiter-new-form__grid">
          <label>
            <span>Company ID *</span>
            <input
              value={form.company_id}
              onChange={(e) => setField('company_id', e.target.value)}
            />
          </label>
          <label>
            <span>Recruiter ID *</span>
            <input
              value={form.recruiter_id}
              onChange={(e) => setField('recruiter_id', e.target.value)}
            />
          </label>
        </div>

        <div className="recruiter-new-form__grid">
          <label>
            <span>Location *</span>
            <input
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="San Francisco, CA"
            />
          </label>
          <label>
            <span>Employment Type *</span>
            <select
              value={form.employment_type}
              onChange={(e) => setField('employment_type', e.target.value)}
            >
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{toTitleCase(opt)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="recruiter-new-form__grid">
          <label>
            <span>Remote *</span>
            <select
              value={form.remote}
              onChange={(e) => setField('remote', e.target.value)}
            >
              {REMOTE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{toTitleCase(opt)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Seniority Level</span>
            <select
              value={form.seniority_level}
              onChange={(e) => setField('seniority_level', e.target.value)}
            >
              {SENIORITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="recruiter-new-form__grid">
          <label>
            <span>Salary Min</span>
            <input
              value={form.salary_min}
              onChange={(e) => setField('salary_min', e.target.value)}
              placeholder="120000"
              inputMode="numeric"
            />
          </label>
          <label>
            <span>Salary Max</span>
            <input
              value={form.salary_max}
              onChange={(e) => setField('salary_max', e.target.value)}
              placeholder="160000"
              inputMode="numeric"
            />
          </label>
        </div>

        <section className="recruiter-new-form__skills">
          <span>Skills Required</span>
          <div className="recruiter-new-form__skills-input">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSkillFromInput()
                }
              }}
              placeholder="Type a skill and press Enter"
            />
            <button type="button" onClick={addSkillFromInput}>Add</button>
          </div>
          <div className="recruiter-new-form__skill-tags">
            {skills.map((skill) => (
              <button key={skill} type="button" onClick={() => removeSkill(skill)}>
                {skill} ×
              </button>
            ))}
          </div>
        </section>

        {errors.length > 0 && (
          <div className="recruiter-new-form__errors">
            {errors.map((err) => <p key={err}>{err}</p>)}
          </div>
        )}

        {submitState.success && (
          <div className="recruiter-new-form__toast recruiter-new-form__toast--success">
            {submitState.success}
          </div>
        )}
        {submitState.error && (
          <div className="recruiter-new-form__toast recruiter-new-form__toast--error">
            {submitState.error}
          </div>
        )}

        <button
          className="recruiter-new-form__submit"
          type="submit"
          disabled={!canSubmit}
        >
          {submitState.loading ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </main>
  )
}
