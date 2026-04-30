import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LinkedInLogo({ size = 34 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [role, setRole] = useState('member')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError('')
    setLoading(true)
    try {
      await register(form.firstName, form.lastName, form.email, form.password, role)
      navigate(role === 'recruiter' ? '/recruiter/dashboard' : '/feed', { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inputProps = (key, type = 'text', extra = {}) => ({
    type,
    value: form[key],
    onChange: set(key),
    style: styles.input,
    onFocus: e => Object.assign(e.target.style, styles.inputFocus),
    onBlur: e => Object.assign(e.target.style, { borderColor: '#CACCCE', boxShadow: 'none' }),
    ...extra,
  })

  return (
    <div style={styles.page}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={{ marginBottom: 28 }}>
            <LinkedInLogo size={52} />
          </div>
          <h1 style={styles.leftHeadline}>
            Make the most of your professional life
          </h1>
          <ul style={styles.benefitList}>
            {[
              'Connect with professionals in your industry',
              'Discover jobs tailored to your skills',
              'Build your professional brand',
              'Stay informed with industry news',
            ].map((item, i) => (
              <li key={i} style={styles.benefitItem}>
                <span style={styles.checkmark}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.formCard}>

          {/* Step indicator */}
          <div style={styles.stepRow}>
            <div style={{ ...styles.stepDot, background: '#0A66C2' }} />
            <div style={styles.stepLine} />
            <div style={{ ...styles.stepDot, background: step >= 2 ? '#0A66C2' : '#CACCCE' }} />
          </div>

          {step === 1 ? (
            <>
              <h2 style={styles.formTitle}>Join LinkedIn</h2>
              <p style={styles.formSubtitle}>Start your professional journey today.</p>

              {error && <div style={styles.errorBox}>{error}</div>}

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    {...inputProps('email', 'email', { required: true, autoFocus: true })}
                  />
                </div>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  onMouseEnter={e => e.currentTarget.style.background = '#004182'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0A66C2'}
                >
                  Continue
                </button>
              </form>

              <p style={styles.agreementText}>
                By clicking Continue, you agree to LinkedIn's{' '}
                <a href="#" style={styles.legalLink}>User Agreement</a>,{' '}
                <a href="#" style={styles.legalLink}>Privacy Policy</a>, and{' '}
                <a href="#" style={styles.legalLink}>Cookie Policy</a>.
              </p>

              <div style={styles.dividerRow}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>Already on LinkedIn?</span>
                <div style={styles.dividerLine} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={styles.signInLink}>Sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h2 style={styles.formTitle}>Create your account</h2>
              <div style={styles.emailRow}>
                <span style={{ fontSize: 14, color: '#56687A' }}>{form.email}</span>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError('') }}
                  style={styles.changeBtn}
                >
                  Change
                </button>
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}

              <form onSubmit={handleSubmit} style={styles.form}>
                {/* Role toggle */}
                <div>
                  <label style={styles.label}>I am joining as a…</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    {[
                      { value: 'member', label: 'Job Seeker / Professional' },
                      { value: 'recruiter', label: 'Recruiter / Employer' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        style={{
                          flex: 1,
                          padding: '11px 8px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          border: role === opt.value ? '2px solid #0A66C2' : '1px solid #CACCCE',
                          background: role === opt.value ? '#EBF3FB' : '#fff',
                          color: role === opt.value ? '#0A66C2' : 'rgba(0,0,0,0.6)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>First name</label>
                    <input {...inputProps('firstName', 'text', { required: true, autoFocus: true })} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Last name</label>
                    <input {...inputProps('lastName', 'text', { required: true })} />
                  </div>
                </div>

                {/* Password */}
                <div style={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={styles.label}>
                      Password <span style={{ fontWeight: 400, color: '#56687A', fontSize: 12 }}>(6+ characters)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={styles.showHideBtn}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    {...inputProps('password', showPassword ? 'text' : 'password', { required: true, minLength: 6 })}
                  />
                </div>

                <p style={styles.agreementText}>
                  By clicking Agree &amp; Join, you agree to LinkedIn's{' '}
                  <a href="#" style={styles.legalLink}>User Agreement</a>,{' '}
                  <a href="#" style={styles.legalLink}>Privacy Policy</a>, and{' '}
                  <a href="#" style={styles.legalLink}>Cookie Policy</a>.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ ...styles.primaryBtn, opacity: loading ? 0.75 : 1 }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.background = '#004182')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#0A66C2')}
                >
                  {loading ? 'Creating account…' : 'Agree & Join'}
                </button>
              </form>

              <p style={{ ...styles.agreementText, textAlign: 'center', marginTop: 16 }}>
                Already on LinkedIn?{' '}
                <Link to="/login" style={styles.switchLink}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  },
  left: {
    flex: '0 0 48%',
    background: 'linear-gradient(160deg, #004182 0%, #0A66C2 60%, #378fe9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  leftInner: { maxWidth: 400 },
  leftHeadline: {
    fontSize: 32,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.3,
    margin: '0 0 28px',
  },
  benefitList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.4,
  },
  checkmark: {
    flexShrink: 0,
    width: 22,
    height: 22,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    marginTop: 1,
  },
  right: {
    flex: '0 0 52%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  stepLine: {
    flex: 1,
    height: 2,
    background: '#CACCCE',
    margin: '0 6px',
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: 'rgba(0,0,0,0.9)',
    margin: '0 0 4px',
  },
  formSubtitle: {
    fontSize: 15,
    color: '#56687A',
    margin: '0 0 20px',
  },
  emailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  changeBtn: {
    fontSize: 13,
    color: '#0A66C2',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },
  errorBox: {
    background: '#fff4f4',
    border: '1px solid #f5c2c2',
    color: '#8a1c1c',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(0,0,0,0.9)',
    marginBottom: 4,
    display: 'block',
  },
  input: {
    border: '1px solid #CACCCE',
    borderRadius: 4,
    padding: '12px 14px',
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    color: 'rgba(0,0,0,0.9)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  },
  inputFocus: {
    borderColor: '#0A66C2',
    boxShadow: '0 0 0 2px rgba(10,102,194,0.2)',
  },
  showHideBtn: {
    background: 'none',
    border: 'none',
    color: '#0A66C2',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    background: '#0A66C2',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
    fontFamily: 'inherit',
  },
  agreementText: {
    fontSize: 12,
    color: '#56687A',
    lineHeight: 1.5,
    margin: 0,
  },
  legalLink: {
    color: '#0A66C2',
    fontWeight: 600,
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '20px 0 16px',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#CACCCE',
  },
  dividerText: {
    fontSize: 13,
    color: '#56687A',
    whiteSpace: 'nowrap',
  },
  signInLink: {
    display: 'inline-block',
    color: '#0A66C2',
    fontWeight: 700,
    fontSize: 16,
    border: '1px solid #0A66C2',
    borderRadius: 999,
    padding: '10px 28px',
    textDecoration: 'none',
    transition: 'background 0.15s',
  },
  switchLink: {
    color: '#0A66C2',
    fontWeight: 700,
    textDecoration: 'none',
  },
}
