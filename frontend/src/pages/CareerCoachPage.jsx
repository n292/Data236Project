import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMember } from '../api/memberApi'
import { searchJobs } from '../api/jobApi'
import { analyzeCareerCoach } from '../api/aiApi'

const LI = {
  blue: '#0A66C2', darkBlue: '#004182', bgMain: '#F3F2EF', bgCard: '#FFFFFF',
  bgBlueTint: '#DCE6F1', black: '#000000', darkGray: '#38434F', slate: '#56687A',
  silver: '#86888A', lightSilver: '#CACCCE',
  green: '#057642', greenBg: '#D7EBCE', greenText: '#44712E',
  amber: '#E7A33E', amberBg: '#FCE2BA', amberText: '#915907',
  red: '#B24020', redBg: '#FADFD8',
}

function SkillTag({ label, variant = 'neutral' }) {
  const styles = {
    matched: { bg: LI.greenBg,    color: LI.greenText },
    missing: { bg: LI.redBg,      color: LI.red       },
    bonus:   { bg: LI.amberBg,    color: LI.amberText },
    neutral: { bg: LI.bgBlueTint, color: LI.darkBlue  },
  }
  const s = styles[variant] || styles.neutral
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
      margin: '3px 3px 0 0',
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
  const icons = {
    skill_gap: '🎯', headline: '✏️', highlight: '⭐',
    about: '📝', differentiator: '💡', experience: '💼',
  }
  return (
    <div style={{
      background: LI.bgCard, border: `1px solid ${LI.lightSilver}`, borderRadius: 10,
      padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icons[s.type] || '💬'}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: LI.black, lineHeight: 1.5 }}>
          {s.suggestion}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: LI.slate, lineHeight: 1.5 }}>{s.rationale}</p>
      </div>
    </div>
  )
}

function BulletList({ items, color }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13, color, lineHeight: 1.7, marginBottom: 2 }}>{item}</li>
      ))}
    </ul>
  )
}

export default function CareerCoachPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  // Job search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)  // { job_id, title, company_name, ... }
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  // Resume upload
  const [resumeFile, setResumeFile] = useState(null)
  const fileInputRef = useRef(null)

  // Analysis state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.member_id) return
    getMember(user.member_id)
      .then(res => setProfile(res?.member || res))
      .catch(() => {})
  }, [user?.member_id])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return }
    setSearchLoading(true)
    try {
      const data = await searchJobs({ keyword: q, limit: 8 })
      const jobs = data.jobs || data.data || []
      setSearchResults(jobs)
      setShowDropdown(jobs.length > 0)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    setSelectedJob(null)
    setResult(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q), 350)
  }

  function selectJob(job) {
    setSelectedJob(job)
    setQuery(`${job.title} — ${job.company_name || job.company || ''}`.trim().replace(/ — $/, ''))
    setShowDropdown(false)
    setResult(null)
    setError('')
  }

  async function handleAnalyze() {
    if (!selectedJob || !user?.member_id) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await analyzeCareerCoach(user.member_id, selectedJob.job_id, resumeFile)
      setResult(data.analysis)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ratingMeta = {
    'Strong Fit':   { color: LI.green, bg: LI.greenBg },
    'Moderate Fit': { color: LI.amber, bg: LI.amberBg },
    'Needs Work':   { color: LI.red,   bg: LI.redBg   },
  }

  const memberSkillsList = (() => {
    if (!profile?.skills) return []
    if (Array.isArray(profile.skills)) return profile.skills
    try { return JSON.parse(profile.skills) } catch { return [] }
  })()

  const inp = {
    width: '100%', padding: '10px 14px', borderRadius: 6,
    border: `1px solid ${LI.lightSilver}`, fontSize: 14, color: LI.darkGray,
    background: LI.bgCard, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ background: LI.bgMain, minHeight: '100vh', padding: '24px 0' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{
          background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8,
          padding: '20px 24px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #0A66C2, #004182)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
            }}>🎓</div>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700 }}>Career Coach</h1>
              <p style={{ margin: 0, fontSize: 13, color: LI.slate }}>
                Select a real job posting — AI analyzes your profile fit and gives personalized guidance.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Profile card */}
          <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Your Profile</div>
            {profile ? (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: LI.black }}>
                  {profile.first_name} {profile.last_name}
                </div>
                {profile.headline && (
                  <div style={{ fontSize: 13, color: LI.slate, marginTop: 2, marginBottom: 10 }}>
                    {profile.headline}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: LI.slate, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Skills ({memberSkillsList.length})
                </div>
                {memberSkillsList.length > 0
                  ? memberSkillsList.map(s => <SkillTag key={s} label={s} />)
                  : <span style={{ fontSize: 13, color: LI.silver }}>No skills on profile yet — add skills for better analysis.</span>
                }
              </>
            ) : (
              <div style={{ color: LI.silver, fontSize: 13 }}>Loading profile…</div>
            )}
          </div>

          {/* Job search card */}
          <div style={{ background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Select a Job to Analyze</div>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input
                value={query}
                onChange={handleQueryChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search by job title, company, or skills…"
                style={inp}
              />
              {searchLoading && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: LI.slate }}>
                  Searching…
                </div>
              )}
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: LI.bgCard, border: `1px solid ${LI.lightSilver}`,
                  borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  maxHeight: 280, overflowY: 'auto', marginTop: 4,
                }}>
                  {searchResults.map(job => (
                    <div
                      key={job.job_id}
                      onMouseDown={() => selectJob(job)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${LI.lightSilver}`,
                        background: selectedJob?.job_id === job.job_id ? LI.bgBlueTint : LI.bgCard,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = LI.bgBlueTint}
                      onMouseLeave={e => e.currentTarget.style.background = selectedJob?.job_id === job.job_id ? LI.bgBlueTint : LI.bgCard}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: LI.black }}>{job.title}</div>
                      <div style={{ fontSize: 12, color: LI.slate }}>
                        {job.company_name || job.company} {job.location ? `· ${job.location}` : ''}
                        {job.seniority_level ? ` · ${job.seniority_level}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedJob && (
              <div style={{
                marginTop: 12, padding: '10px 12px', background: LI.bgBlueTint,
                borderRadius: 6, fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, color: LI.darkBlue }}>{selectedJob.title}</div>
                <div style={{ color: LI.slate, fontSize: 12 }}>
                  {selectedJob.company_name || selectedJob.company}
                  {selectedJob.location ? ` · ${selectedJob.location}` : ''}
                </div>
              </div>
            )}

            {/* Resume upload */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: LI.slate, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Upload Resume (PDF) <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional, improves analysis</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setResumeFile(e.target.files?.[0] || null)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${resumeFile ? LI.blue : LI.lightSilver}`,
                  borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
                  background: resumeFile ? LI.bgBlueTint : LI.bgMain,
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{resumeFile ? '📄' : '⬆️'}</span>
                <div style={{ flex: 1 }}>
                  {resumeFile ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: LI.darkBlue }}>{resumeFile.name}</div>
                      <div style={{ fontSize: 11, color: LI.slate }}>{(resumeFile.size / 1024).toFixed(0)} KB · click to change</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: LI.slate }}>Click to upload your resume PDF</div>
                  )}
                </div>
                {resumeFile && (
                  <span
                    onClick={e => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{ fontSize: 16, color: LI.silver, cursor: 'pointer', padding: '2px 4px' }}
                  >✕</span>
                )}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedJob}
              style={{
                marginTop: 14, padding: '10px 24px', borderRadius: 24, border: 'none',
                background: (loading || !selectedJob) ? LI.lightSilver : LI.blue,
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: (loading || !selectedJob) ? 'not-allowed' : 'pointer',
                width: '100%', transition: 'background 0.15s',
              }}
            >
              {loading ? 'Analyzing…' : 'Analyze My Fit'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            background: LI.redBg, border: `1px solid ${LI.red}`, borderRadius: 8,
            padding: '14px 18px', color: LI.red, fontSize: 14, marginBottom: 16,
          }}>
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
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 19, fontWeight: 700, color: LI.black }}>{result.job_title}</span>
                    {result.company_name && (
                      <span style={{ fontSize: 14, color: LI.slate }}>at {result.company_name}</span>
                    )}
                    <span style={{
                      padding: '4px 14px', borderRadius: 20, background: rm.bg, color: rm.color,
                      fontWeight: 700, fontSize: 13,
                    }}>{result.overall_rating}</span>
                  </div>
                  <div style={{ fontSize: 13, color: LI.slate }}>
                    You match <strong>{result.matched_skills.length}</strong> of <strong>{result.target_skill_count}</strong> required skills.
                    {result.missing_skills.length > 0 && (
                      <> Close {result.missing_skills.length} gap{result.missing_skills.length !== 1 ? 's' : ''} to become a top candidate.</>
                    )}
                  </div>
                </div>
              </div>

              {/* Skill breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '✅ You Have', skills: result.matched_skills, variant: 'matched', empty: 'None matched' },
                  { label: '❌ You Need', skills: result.missing_skills, variant: 'missing', empty: 'No gaps — great fit!' },
                  { label: '💡 Your Extras', skills: result.bonus_skills, variant: 'bonus', empty: 'No extras listed' },
                ].map(({ label, skills, variant, empty }) => (
                  <div key={label} style={{
                    background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`,
                    borderRadius: 8, padding: '14px 16px',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label}</div>
                    {skills.length > 0
                      ? skills.map(s => <SkillTag key={s} label={s} variant={variant} />)
                      : <span style={{ fontSize: 12, color: LI.silver }}>{empty}</span>
                    }
                  </div>
                ))}
              </div>

              {/* Strengths & Improvement Areas */}
              {(result.strengths?.length > 0 || result.improvement_areas?.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {result.strengths?.length > 0 && (
                    <div style={{
                      background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`,
                      borderRadius: 8, padding: '16px 18px',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: LI.green, marginBottom: 10 }}>
                        💪 Your Strengths
                      </div>
                      <BulletList items={result.strengths} color={LI.darkGray} />
                    </div>
                  )}
                  {result.improvement_areas?.length > 0 && (
                    <div style={{
                      background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`,
                      borderRadius: 8, padding: '16px 18px',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: LI.amber, marginBottom: 10 }}>
                        📈 Areas to Improve
                      </div>
                      <BulletList items={result.improvement_areas} color={LI.darkGray} />
                    </div>
                  )}
                </div>
              )}

              {/* Headline / About rewrites */}
              {(result.headline_rewrite || result.about_rewrite) && (
                <div style={{
                  background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`,
                  borderRadius: 8, padding: '18px 22px', marginBottom: 16,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>✏️ Suggested Profile Rewrites</div>
                  {result.headline_rewrite && (
                    <div style={{ marginBottom: result.about_rewrite ? 14 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: LI.slate, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Headline</div>
                      <div style={{
                        padding: '10px 14px', background: LI.bgBlueTint, borderRadius: 6,
                        fontSize: 14, fontWeight: 600, color: LI.darkBlue,
                      }}>
                        "{result.headline_rewrite}"
                      </div>
                    </div>
                  )}
                  {result.about_rewrite && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: LI.slate, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>About (opening line)</div>
                      <div style={{
                        padding: '10px 14px', background: LI.bgBlueTint, borderRadius: 6,
                        fontSize: 13, color: LI.darkGray, fontStyle: 'italic', lineHeight: 1.6,
                      }}>
                        "{result.about_rewrite}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actionable suggestions */}
              {result.suggestions?.length > 0 && (
                <div style={{
                  background: LI.bgCard, border: `1px solid rgba(0,0,0,0.12)`,
                  borderRadius: 8, padding: '20px 24px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
                    Personalized Action Plan
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
