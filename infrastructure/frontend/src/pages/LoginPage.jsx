import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LinkedInLogo({ size = 34 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/feed'

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      const dest = from !== '/feed' ? from : (user?.role === 'recruiter' ? '/recruiter/dashboard' : '/feed')
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logoWrap}>
            <LinkedInLogo size={52} />
          </div>
          <h1 style={styles.leftHeadline}>
            Welcome to your professional community.
          </h1>
          {/* Decorative network illustration */}
          <div style={styles.illustration}>
            <svg viewBox="0 0 320 260" width="320" height="260" fill="none">
              <circle cx="160" cy="130" r="40" fill="rgba(255,255,255,0.12)" />
              <circle cx="160" cy="130" r="70" fill="rgba(255,255,255,0.07)" />
              <circle cx="160" cy="130" r="100" fill="rgba(255,255,255,0.04)" />
              {/* nodes */}
              {[
                [160,90],[220,110],[230,170],[160,200],[90,170],[80,110],
                [140,60],[260,90],[280,150],[200,220],[120,220],[40,150],[60,80]
              ].map(([cx,cy],i) => (
                <circle key={i} cx={cx} cy={cy} r="6" fill="rgba(255,255,255,0.7)" />
              ))}
              {/* edges */}
              {[
                [160,90,220,110],[220,110,230,170],[230,170,160,200],
                [160,200,90,170],[90,170,80,110],[80,110,160,90],
                [160,90,140,60],[220,110,260,90],[260,90,280,150],
                [230,170,200,220],[160,200,120,220],[90,170,40,150],[80,110,60,80]
              ].map(([x1,y1,x2,y2],i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              ))}
              {/* center person */}
              <circle cx="160" cy="130" r="18" fill="rgba(255,255,255,0.9)" />
              <circle cx="160" cy="122" r="7" fill="#0A66C2" />
              <path d="M147 142c0-7.2 5.8-13 13-13s13 5.8 13 13" stroke="#0A66C2" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Sign in</h2>
          <p style={styles.formSubtitle}>Stay updated on your professional world</p>

          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email or phone</label>
              <input
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={styles.input}
                onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                onBlur={e => Object.assign(e.target.style, { borderColor: '#CACCCE', boxShadow: 'none' })}
              />
            </div>

            <div style={styles.fieldGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={styles.label}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={styles.showHideBtn}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={styles.input}
                onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                onBlur={e => Object.assign(e.target.style, { borderColor: '#CACCCE', boxShadow: 'none' })}
              />
            </div>

            <a href="#" style={styles.forgotLink}>Forgot password?</a>

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.primaryBtn, opacity: loading ? 0.75 : 1 }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#004182')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0A66C2')}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={styles.dividerRow}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerLine} />
          </div>

          <p style={styles.switchText}>
            New to LinkedIn?{' '}
            <Link to="/register" style={styles.switchLink}>Join now</Link>
          </p>
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
    flex: '0 0 55%',
    background: 'linear-gradient(135deg, #004182 0%, #0A66C2 55%, #378fe9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  leftInner: {
    maxWidth: 420,
  },
  logoWrap: {
    marginBottom: 32,
  },
  leftHeadline: {
    fontSize: 36,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.25,
    margin: '0 0 40px',
    letterSpacing: '-0.5px',
  },
  illustration: {
    opacity: 0.9,
  },
  right: {
    flex: '0 0 45%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },
  formCard: {
    width: '100%',
    maxWidth: 360,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: 'rgba(0,0,0,0.9)',
    margin: '0 0 4px',
  },
  formSubtitle: {
    fontSize: 15,
    color: '#56687A',
    margin: '0 0 24px',
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
  forgotLink: {
    color: '#0A66C2',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    alignSelf: 'flex-start',
    marginTop: -8,
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
    letterSpacing: '0.01em',
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0',
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
  switchText: {
    textAlign: 'center',
    fontSize: 15,
    color: 'rgba(0,0,0,0.9)',
    margin: 0,
  },
  switchLink: {
    color: '#0A66C2',
    fontWeight: 700,
    textDecoration: 'none',
  },
}
