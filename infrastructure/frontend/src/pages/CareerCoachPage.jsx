import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMember } from '../api/memberApi'
import { getCareerCoachAnalysis } from '../api/aiApi'

const LI = {
  blue: '#0A66C2', darkBlue: '#004182', bgMain: '#F3F2EF', bgCard: '#FFFFFF',
  bgBlueTint: '#DCE6F1', black: '#000000', darkGray: '#38434F', slate: '#56687A',
  silver: '#86888A', lightSilver: '#CACCCE',
  green: '#057642', greenBg: '#D7EBCE', greenText: '#44712E',
  amber: '#E7A33E', amberBg: '#FCE2BA',
  red: '#B24020', redBg: '#FADFD8',
}

const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 6,
  border: `1px solid ${LI.lightSilver}`, fontSize: 14, color: LI.darkGray,
  background: LI.bgCard, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'border-color 0.15s',
}

function SkillTag({ label, variant = 'neutral' }) {
  const styles = {
    matched: { bg: LI.greenBg,    color: LI.greenText },
    missing: { bg: LI.redBg,      color: LI.red       },
    bonus:   { bg: LI.amberBg,    color: '#915907'    },
    neutral: { bg: LI.bgBlueTint, color: LI.darkBlue  },
  }
  const s = styles[variant] || styles.neutral
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, margin: '3px 3px 0 0',
    }}>{label}</span>
  )
}

function ScoreRing({ pct, color }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={110} height={110} style={{ flexShrink: 0 }}>
      <circle cx={55} cy={55} r={r} fill="none" stroke={LI.bgBlueTint} strokeWidth={10} />
      <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 55 55)" />
      <text x={55} y={51} textAnchor="middle" fontSize={20} fontWeight={700} fill={color}>{pct}%</text>
      <text x={55} y={67} textAnchor="middle" fontSize={10} fill={LI.slate}>match</text>
    </svg>
  )
}

function SuggestionCard({ s }) {
  const icons = { skill_gap: '🎯', headline: '✏️', highlight: '⭐', profile_completeness: '📋', differentiator: '💡' }
  const priorityColor = { high: LI.red, medium: LI.amber, low: LI.slate }
  return (
    <div style={{
      background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10,
      padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icons[s.type] || '💬'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: LI.black }}>{s.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color: priorityColor[s.priority] || LI.slate,
          }}>{s.priority}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: LI.darkGray, lineHeight: 1.6 }}>{s.detail}</p>
      </div>
    </div>
  )
}

const POPULAR_JOBS = [
  { label: 'Software Engineer', skills: ['python', 'javascript', 'react', 'node.js', 'sql', 'docker', 'aws'] },
  { label: 'Data Scientist', skills: ['python', 'machine learning', 'sql', 'pytorch', 'tensorflow', 'spark'] },
  { label: 'Frontend Engineer', skills: ['react', 'typescript', 'javascript', 'graphql', 'css'] },
  { label: 'DevOps Engineer', skills: ['docker', 'kubernetes', 'aws', 'terraform', 'ci/cd'] },
  { label: 'Product Manager', skills: ['product strategy', 'agile', 'sql', 'roadmapping', 'communication'] },
  { label: 'ML Engineer', skills: ['python', 'tensorflow', 'pytorch', 'mlops', 'spark', 'kafka'] },
]

export default function CareerCoachPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [targetJob, setTargetJob] = useState('')
  const [targetSkillsRaw, setTargetSkillsRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.member_id) return
    getMember(user.member_id)
      .then(res => setProfile(res?.member || res))
      .catch(() => {})
  }, [user?.member_id])

  function applyTemplate(job) {
    setTargetJob(job.label)
    setTargetSkillsRaw(job.skills.join(', '))
  }

  async function handleAnalyze(e) {
    e.preventDefault()
    if (!targetJob.trim()) return
    setLoading(true); setError(''); setResult(null)

    const memberSkills = (() => {
      if (!profile?.skills) return []
      if (Array.isArray(profile.skills)) return profile.skills
      try { return JSON.parse(profile.skills) } catch { return [] }
    })()

    const targetSkills = targetSkillsRaw
      .split(/[,\n]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)

    try {
      const data = await getCareerCoachAnalysis({
        member_skills: memberSkills,
        headline: profile?.headline || '',
        target_job: targetJob.trim(),
        target_skills: targetSkills,
      })
      setResult(data.analysis)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ratingMeta = {
    'Strong Fit': { color: LI.green, bg: LI.greenBg },
    'Moderate Fit': { color: LI.amber, bg: LI.amberBg },
    'Needs Work': { color: LI.red, bg: LI.redBg },
  }

  const memberSkillsList = (() => {
    if (!profile?.skills) return []
    if (Array.isArray(profile.skills)) return profile.skills
    try { return JSON.parse(profile.skills) } catch { return [] }
  })()

  return (
    <div style={{ background: LI.bgMain, minHeight: '100vh', padding: '24px 0' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #0A66C2, #004182)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🎓</div>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700 }}>Career Coach</h1>
              <p style={{ margin: 0, fontSize: 13, color: LI.slate }}>
                AI-powered analysis of your profile fit for a target role — with actionable improvement suggestions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Your profile card */}
          <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Your Profile</div>
            {profile ? (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: LI.black }}>{profile.first_name} {profile.last_name}</div>
                {profile.headline && <div style={{ fontSize: 13, color: LI.slate, marginTop: 2, marginBottom: 10 }}>{profile.headline}</div>}
                <div style={{ fontSize: 12, fontWeight: 600, color: LI.slate, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Your Skills ({memberSkillsList.length})
                </div>
                <div>
                  {memberSkillsList.length > 0
                    ? memberSkillsList.map(s => <SkillTag key={s} label={s} />)
                    : <span style={{ fontSize: 13, color: LI.silver }}>No skills on profile yet — add skills to your profile for better analysis.</span>
                  }
                </div>
              </>
            ) : (
              <div style={{ color: LI.silver, fontSize: 13 }}>Loading your profile…</div>
            )}
          </div>

          {/* Quick templates */}
          <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Quick Job Templates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_JOBS.map(j => (
                <button key={j.label} onClick={() => applyTemplate(j)} style={{
                  padding: '6px 14px', borderRadius: 20, border: `1px solid ${LI.lightSilver}`,
                  background: targetJob === j.label ? LI.bgBlueTint : LI.bgCard,
                  color: targetJob === j.label ? LI.darkBlue : LI.darkGray,
                  fontSize: 13, fontWeight: targetJob === j.label ? 700 : 400,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{j.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Analysis form */}
        <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Target Role</div>
          <form onSubmit={handleAnalyze}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>Job Title</label>
                <input
                  value={targetJob} onChange={e => setTargetJob(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  style={inp}
                  onFocus={e => e.target.style.borderColor = LI.blue}
                  onBlur={e => e.target.style.borderColor = LI.lightSilver}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: LI.darkGray, marginBottom: 6 }}>Required Skills (comma separated)</label>
                <input
                  value={targetSkillsRaw} onChange={e => setTargetSkillsRaw(e.target.value)}
                  placeholder="e.g. Python, AWS, React, SQL"
                  style={inp}
                  onFocus={e => e.target.style.borderColor = LI.blue}
                  onBlur={e => e.target.style.borderColor = LI.lightSilver}
                />
              </div>
            </div>
            <button type="submit" disabled={loading || !targetJob.trim()} style={{
              padding: '10px 28px', borderRadius: 24, border: 'none',
              background: (loading || !targetJob.trim()) ? LI.lightSilver : LI.blue,
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: (loading || !targetJob.trim()) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}>
              {loading ? 'Analyzing…' : 'Analyze My Fit'}
            </button>
          </form>
        </div>

        {error && (
          <div style={{ background: LI.redBg, border: `1px solid ${LI.red}`, borderRadius: 8, padding: '14px 18px', color: LI.red, fontSize: 14, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {result && (() => {
          const rm = ratingMeta[result.overall_rating] || ratingMeta['Needs Work']
          return (
            <>
              {/* Score summary */}
              <div style={{
                background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8,
                padding: '20px 24px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
              }}>
                <ScoreRing pct={result.skill_match_pct} color={rm.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: LI.black }}>{result.target_job}</span>
                    <span style={{ padding: '4px 14px', borderRadius: 20, background: rm.bg, color: rm.color, fontWeight: 700, fontSize: 13 }}>
                      {result.overall_rating}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: LI.slate }}>
                    You match <strong>{result.matched_skills.length}</strong> of <strong>{result.target_skill_count}</strong> required skills.
                    {result.missing_skills.length > 0 && <> Close {result.missing_skills.length} gap{result.missing_skills.length > 1 ? 's' : ''} to become a top candidate.</>}
                  </div>
                  {result.headline_suggestion && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: LI.bgBlueTint, borderRadius: 6, fontSize: 13, color: LI.darkBlue }}>
                      ✏️ Suggested headline: <strong>"{result.headline_suggestion}"</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Skill breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '✅ You Have', skills: result.matched_skills, variant: 'matched', empty: 'None matched' },
                  { label: '❌ You Need', skills: result.missing_skills, variant: 'missing', empty: 'No gaps — great fit!' },
                  { label: '💡 Your Extras', skills: result.bonus_skills, variant: 'bonus', empty: 'No extras listed' },
                ].map(({ label, skills, variant, empty }) => (
                  <div key={label} style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</div>
                    {skills.length > 0
                      ? skills.map(s => <SkillTag key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} variant={variant} />)
                      : <span style={{ fontSize: 12, color: LI.silver }}>{empty}</span>
                    }
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
                    Personalized Recommendations
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
