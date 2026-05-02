import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteMember, getMember, updateMember, uploadPhoto, uploadBanner } from '../api/memberApi'
import { resolveUploadUrl } from '../utils/mediaUrl'
import { formatDisplayName } from '../utils/profileDisplay'
import { requestConnection, listConnections, openThread } from '../services/api'
import { useAuth } from '../context/AuthContext'

function initials(fn = '', ln = '') {
  return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'M'
}
function parseJson(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

const AVATAR_COLORS = ['#004182','#057642','#b24020','#5f4b8b','#c37d16','#1b6f72','#0a66c2']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}


function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#56687A" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#56687A" strokeWidth="1.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

// ── Shared modal shell (portal = above navbar/stacking contexts) ──
function Modal({ title, onClose, children }) {
  return createPortal(
    (
      <div
        className="li-modal-overlay"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="li-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="li-modal-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="li-modal-dialog__header">
            <h3 id="li-modal-title" className="li-modal-dialog__title">{title}</h3>
            <button type="button" className="li-modal-dialog__close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="li-modal-dialog__body">{children}</div>
        </div>
      </div>
    ),
    document.body
  )
}

function FormField({ label, name, value, onChange, type = 'text', placeholder = '', rows }) {
  const style = {
    width: '100%', padding: '8px 12px', fontSize: 14,
    border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box',
    fontFamily: 'inherit',
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'rgba(0,0,0,0.75)' }}>
        {label}
      </label>
      {rows
        ? <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ ...style, resize: 'vertical' }} />
        : <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} style={style} />
      }
    </div>
  )
}

function SaveBar({ saving, error, onSave, onClose }) {
  return (
    <>
      {error && <p style={{ color: '#c00', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
        <button type="button" onClick={onClose} style={{
          padding: '8px 20px', borderRadius: 20, border: '1px solid #56687A',
          background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#38434F',
        }}>Cancel</button>
        <button type="button" onClick={onSave} disabled={saving} style={{
          padding: '8px 20px', borderRadius: 20, border: 'none',
          background: '#0A66C2', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1,
        }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </>
  )
}

// ── About modal ──────────────────────────────────────────────────
function AboutModal({ memberId, initial, onSaved, onClose }) {
  const [text, setText] = useState(() => (initial == null ? '' : String(initial)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setText(initial == null ? '' : String(initial))
  }, [initial, memberId])

  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, about_summary: text.trim() || null })
      onSaved()
    } catch (e) { setError(e.message || 'Could not save') }
    finally { setSaving(false) }
  }
  return (
    <Modal title="About" onClose={onClose}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#56687A' }}>
        Summarize your professional background, interests, or goals.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={8}
        placeholder="Tell people about yourself…"
        className="li-modal-textarea"
      />
      <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
    </Modal>
  )
}

// ── Headline modal (intro line under your name) ───────────────────
function HeadlineModal({ memberId, initial, onSaved, onClose }) {
  const [headline, setHeadline] = useState(() => (initial == null ? '' : String(initial)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setHeadline(initial == null ? '' : String(initial))
  }, [initial, memberId])

  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, headline: headline.trim() || null })
      onSaved()
    } catch (e) { setError(e.message || 'Could not save') }
    finally { setSaving(false) }
  }
  return (
    <Modal title="Headline" onClose={onClose}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#56687A' }}>
        This appears under your name — roles, school, or what you&apos;re open to.
      </p>
      <input
        type="text"
        value={headline}
        onChange={e => setHeadline(e.target.value)}
        placeholder="e.g. Student at SJSU | ML & Distributed Systems"
        className="li-modal-input"
        maxLength={255}
      />
      <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
    </Modal>
  )
}

// ── Experience modal ─────────────────────────────────────────────
const BLANK_EXP = { title: '', company: '', start_date: '', end_date: '', description: '' }
function ExperienceModal({ memberId, initial, onSaved, onClose }) {
  const [items, setItems] = useState(initial.length ? initial : [{ ...BLANK_EXP }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [form, setForm] = useState({ ...BLANK_EXP })

  const openEdit = (idx) => { setEditIdx(idx); setForm({ ...BLANK_EXP, ...items[idx] }) }
  const openAdd  = () => { setEditIdx('new'); setForm({ ...BLANK_EXP }) }
  const cancelEdit = () => { setEditIdx(null) }

  const applyEdit = () => {
    if (editIdx === 'new') {
      setItems(prev => [...prev, { ...form }])
    } else {
      setItems(prev => prev.map((it, i) => i === editIdx ? { ...form } : it))
    }
    setEditIdx(null)
  }
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, experience: items })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const fc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Edit experience" onClose={onClose}>
      {editIdx !== null ? (
        <>
          <FormField label="Job title *" name="title" value={form.title} onChange={fc} placeholder="e.g. Software Engineer" />
          <FormField label="Company *" name="company" value={form.company} onChange={fc} placeholder="e.g. Google" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Start date" name="start_date" value={form.start_date} onChange={fc} placeholder="e.g. Jan 2020" />
            <FormField label="End date" name="end_date" value={form.end_date} onChange={fc} placeholder="Present" />
          </div>
          <FormField label="Description" name="description" value={form.description} onChange={fc} placeholder="Describe your role…" rows={3} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={applyEdit} disabled={!form.title || !form.company} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: '#0A66C2', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Apply</button>
          </div>
        </>
      ) : (
        <>
          {items.map((exp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 4, background: '#EEF3F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#0A66C2', flexShrink: 0 }}>
                {(exp.company || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{exp.title || 'Position'}</div>
                <div style={{ fontSize: 13, color: '#56687A' }}>{exp.company}</div>
                {(exp.start_date || exp.end_date) && (
                  <div style={{ fontSize: 12, color: '#8c9aa5' }}>{exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : ' – Present'}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#56687A' }}>✏️</button>
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#c00' }}>🗑</button>
              </div>
            </div>
          ))}
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
            color: '#0A66C2', fontWeight: 600, fontSize: 14, marginTop: 8,
          }}>+ Add position</button>
          <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
        </>
      )}
    </Modal>
  )
}

// ── Education modal ──────────────────────────────────────────────
const BLANK_EDU = { institution: '', degree: '', field_of_study: '', start_year: '', end_year: '' }
function EducationModal({ memberId, initial, onSaved, onClose }) {
  const [items, setItems] = useState(initial.length ? initial : [{ ...BLANK_EDU }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [form, setForm] = useState({ ...BLANK_EDU })

  const openEdit = (idx) => { setEditIdx(idx); setForm({ ...BLANK_EDU, ...items[idx] }) }
  const openAdd  = () => { setEditIdx('new'); setForm({ ...BLANK_EDU }) }
  const cancelEdit = () => setEditIdx(null)
  const applyEdit = () => {
    if (editIdx === 'new') setItems(prev => [...prev, { ...form }])
    else setItems(prev => prev.map((it, i) => i === editIdx ? { ...form } : it))
    setEditIdx(null)
  }
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))
  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, education: items })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }
  const fc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Edit education" onClose={onClose}>
      {editIdx !== null ? (
        <>
          <FormField label="School / University *" name="institution" value={form.institution} onChange={fc} placeholder="e.g. UC Berkeley" />
          <FormField label="Degree" name="degree" value={form.degree} onChange={fc} placeholder="e.g. Bachelor of Science" />
          <FormField label="Field of study" name="field_of_study" value={form.field_of_study} onChange={fc} placeholder="e.g. Computer Science" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Start year" name="start_year" value={form.start_year} onChange={fc} placeholder="e.g. 2018" />
            <FormField label="End year" name="end_year" value={form.end_year} onChange={fc} placeholder="e.g. 2022" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={applyEdit} disabled={!form.institution} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: '#0A66C2', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Apply</button>
          </div>
        </>
      ) : (
        <>
          {items.map((edu, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 4, background: '#FDF9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#915907', flexShrink: 0 }}>
                {(edu.institution || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{edu.institution || 'Institution'}</div>
                <div style={{ fontSize: 13, color: '#56687A' }}>{[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}</div>
                {(edu.start_year || edu.end_year) && (
                  <div style={{ fontSize: 12, color: '#8c9aa5' }}>{edu.start_year}{edu.end_year ? ` – ${edu.end_year}` : ''}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#56687A' }}>✏️</button>
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#c00' }}>🗑</button>
              </div>
            </div>
          ))}
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
            color: '#0A66C2', fontWeight: 600, fontSize: 14, marginTop: 8,
          }}>+ Add education</button>
          <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
        </>
      )}
    </Modal>
  )
}

// ── Skills modal ─────────────────────────────────────────────────
function SkillsModal({ memberId, initial, onSaved, onClose }) {
  const [skills, setSkills] = useState(initial.length ? [...initial] : [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addSkill = () => {
    const s = input.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setInput('')
  }
  const removeSkill = (s) => setSkills(prev => prev.filter(x => x !== s))
  const handleKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }

  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, skills })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Edit skills" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#56687A', marginTop: 0, marginBottom: 12 }}>
        Type a skill and press Enter or Add to include it.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="e.g. Python, React, SQL…"
          style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button onClick={addSkill} style={{
          padding: '8px 16px', borderRadius: 4, border: '1px solid #0A66C2',
          background: '#fff', color: '#0A66C2', cursor: 'pointer', fontWeight: 600, fontSize: 14,
        }}>Add</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 40, marginBottom: 16 }}>
        {skills.map(s => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#EEF3F8', borderRadius: 20, padding: '4px 12px',
            fontSize: 13, fontWeight: 500, color: '#0A66C2',
          }}>
            {s}
            <button onClick={() => removeSkill(s)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#56687A', fontSize: 14, lineHeight: 1, padding: 0,
            }}>×</button>
          </span>
        ))}
        {skills.length === 0 && (
          <span style={{ fontSize: 13, color: '#8c9aa5' }}>No skills added yet.</span>
        )}
      </div>
      <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
    </Modal>
  )
}

// ── Contact modal ────────────────────────────────────────────────
function ContactModal({ memberId, initial, onSaved, onClose }) {
  const [form, setForm] = useState({
    email: initial.email || '',
    phone: initial.phone || '',
    city: initial.city || '',
    state: initial.state || '',
    country: initial.country || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const save = async () => {
    setSaving(true); setError('')
    try {
      await updateMember({ member_id: memberId, ...form })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }
  return (
    <Modal title="Edit contact & location" onClose={onClose}>
      <FormField label="Email" name="email" type="email" value={form.email} onChange={fc} placeholder="you@example.com" />
      <FormField label="Phone" name="phone" value={form.phone} onChange={fc} placeholder="+1 (555) 000-0000" />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' }}>
        Location
      </div>
      <FormField label="City" name="city" value={form.city} onChange={fc} placeholder="San Francisco" />
      <FormField label="State / region" name="state" value={form.state} onChange={fc} placeholder="California" />
      <FormField label="Country" name="country" value={form.country} onChange={fc} placeholder="United States" />
      <SaveBar saving={saving} error={error} onSave={save} onClose={onClose} />
    </Modal>
  )
}

const SUGGESTED = [
  { name: 'Alex Rodriguez', headline: 'Staff Engineer at Uber',   initial: 'A' },
  { name: 'Priya Sharma',   headline: 'Senior SWE at Netflix',   initial: 'P' },
  { name: 'Sarah Chen',     headline: 'EM at Amazon | Hiring',   initial: 'S' },
]

export default function MemberDetailPage() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const isOwnProfile = Boolean(user?.member_id && user.member_id === memberId)

  const [member, setMember]             = useState(null)
  const [error, setError]               = useState('')
  // 'none' | 'pending_sent' | 'pending_received' | 'accepted'
  const [connStatus, setConnStatus]     = useState('none')
  const [connLoading, setConnLoading]   = useState(false)
  const [msgLoading, setMsgLoading]     = useState(false)
  const [following, setFollowing]       = useState(false)
  const [modal, setModal]               = useState(null)
  const photoInputRef                   = useRef(null)
  const bannerInputRef                  = useRef(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [liveConnections, setLiveConnections] = useState(null)   // accepted connections for this profile
  const [connModalOpen, setConnModalOpen]     = useState(false)
  const [connProfiles, setConnProfiles]       = useState({})     // id → member object
  const loadMember = () =>
    getMember(memberId, {
      viewerId: localStorage.getItem('viewer_id') || null,
      emitProfileViewed: !isOwnProfile,
      viewSource: 'profile_page',
    })
      .then(d => setMember(d.member))
      .catch(e => setError(e.message))

  const loadLiveConnections = useCallback(async () => {
    try {
      const data = await listConnections(memberId)
      const accepted = (data.connections || []).filter(c => c.status === 'accepted')
      setLiveConnections(accepted)
    } catch { /* non-fatal */ }
  }, [memberId])

  // Load connection status between logged-in user and this profile
  const loadConnectionStatus = async () => {
    if (!user?.member_id || isOwnProfile) return
    try {
      const data = await listConnections(user.member_id)
      const conn = (data.connections || []).find(c => c.connected_user_id === memberId)
      if (!conn) { setConnStatus('none'); return }
      if (conn.status === 'accepted') { setConnStatus('accepted'); return }
      if (conn.status === 'pending') {
        setConnStatus(conn.direction === 'sent' ? 'pending_sent' : 'pending_received')
      }
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    loadMember()
    loadConnectionStatus()
    loadLiveConnections()
  }, [memberId])

  // Fetch member profiles for the connections modal
  const openConnectionsModal = async () => {
    setConnModalOpen(true)
    if (!liveConnections) return
    const missing = liveConnections
      .map(c => c.connected_user_id)
      .filter(id => id && !connProfiles[id])
    if (missing.length === 0) return
    const fetched = await Promise.all(
      missing.map(id => getMember(id).then(r => [id, r?.member || r]).catch(() => [id, null]))
    )
    setConnProfiles(prev => ({ ...prev, ...Object.fromEntries(fetched.filter(([, m]) => m)) }))
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this profile? This cannot be undone.')) return
    try { await deleteMember(memberId); navigate('/members/search') }
    catch (e) { setError(e.message) }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      await uploadPhoto(file, memberId)
      loadMember()
      if (isOwnProfile) await refreshUser()
    } catch (err) { setError(err.message) }
    finally { setPhotoUploading(false); e.target.value = '' }
  }

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerUploading(true)
    try {
      await uploadBanner(file, memberId)
      loadMember()
      if (isOwnProfile) await refreshUser()
    } catch (err) { setError(err.message) }
    finally { setBannerUploading(false); e.target.value = '' }
  }

  const onSaved = async () => {
    setModal(null)
    loadMember()
    if (isOwnProfile) {
      try { await refreshUser() } catch { /* ignore */ }
    }
  }

  const handleConnect = async () => {
    if (!user?.member_id || connLoading) return
    setConnLoading(true)
    try {
      await requestConnection(user.member_id, memberId)
      setConnStatus('pending_sent')
      loadLiveConnections()
    } catch (e) {
      setError(e.message)
    } finally {
      setConnLoading(false)
    }
  }

  const handleMessage = async () => {
    if (!user?.member_id || msgLoading) return
    setMsgLoading(true)
    try {
      const data = await openThread([user.member_id, memberId])
      navigate('/messaging', { state: { selectedThreadId: data.thread_id } })
    } catch (e) {
      setError(e.message)
    } finally {
      setMsgLoading(false)
    }
  }

  if (error) return <div className="alert error-alert">{error}</div>
  if (!member) return <div style={{ textAlign: 'center', paddingTop: 60, color: '#56687A' }}>Loading profile…</div>

  const fullNameRaw = `${member.first_name} ${member.last_name}`.trim()
  const displayName = formatDisplayName(member.first_name, member.last_name)
  const location   = [member.city, member.state, member.country].filter(Boolean).join(', ')
  const skills     = parseJson(member.skills)
  const experience = parseJson(member.experience)
  const education  = parseJson(member.education)
  const bgColor    = avatarColor(fullNameRaw || displayName)

  return (
    <div className="li-profile">
      {/* ── MAIN COLUMN ── */}
      <div className="li-profile__main">

        {/* Top card */}
        <div className="li-profile-card">
          <div
            className={`li-profile-banner${member.banner_image_url ? ' li-profile-banner--image' : ''}`}
            style={member.banner_image_url ? { backgroundImage: `url(${resolveUploadUrl(member.banner_image_url)})` } : undefined}
          >
            {isOwnProfile && (
              <>
                <button
                  type="button"
                  className="li-profile-banner__edit li-profile-banner__edit--icon"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={bannerUploading}
                  title={bannerUploading ? 'Uploading…' : 'Edit background image'}
                  aria-label="Edit background image"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleBannerChange}
                />
              </>
            )}
            <div className="li-profile-avatar-wrap">
              <div className="li-profile-avatar" style={{ background: bgColor }}>
                {member.profile_photo_url
                  ? <img src={resolveUploadUrl(member.profile_photo_url)} alt={displayName} />
                  : initials(member.first_name, member.last_name)}

                {/* Camera overlay — own profile only */}
                {isOwnProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading}
                      title="Change photo"
                      style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(0,0,0,0)', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: 8, transition: 'background 0.15s',
                        opacity: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.opacity = 1 }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = 0 }}
                    >
                      <CameraIcon />
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file" accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoChange}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="li-profile-card__body">
            <div className="li-profile-intro">
              <div className="li-profile-intro__spacer" aria-hidden />
              <div className="li-profile-intro__main">
                <div className="li-profile-intro__title-row">
                  <h1 className="li-profile-card__name">{displayName}</h1>
                  {isOwnProfile && (
                    <button
                      type="button"
                      className="li-profile-icon-btn"
                      aria-label="Edit headline"
                      title="Edit headline"
                      onClick={() => setModal('headline')}
                    >
                      <EditIcon />
                    </button>
                  )}
                </div>
                {(member.headline?.trim() || isOwnProfile) && (
                  <p className="li-profile-card__headline">
                    {member.headline?.trim()
                      ? member.headline
                      : isOwnProfile
                        ? <span className="li-profile-headline-placeholder">Add a headline…</span>
                        : null}
                  </p>
                )}
                {location ? (
                  <p className="li-profile-card__location">{location}</p>
                ) : isOwnProfile ? (
                  <p className="li-profile-card__location" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="li-profile-inline-link"
                      onClick={() => setModal('contact')}
                    >
                      Add location
                    </button>
                  </p>
                ) : null}
                <button
                  type="button"
                  className="li-profile-card__connections-btn"
                  onClick={openConnectionsModal}
                >
                  <span className="li-profile-card__connections">
                    {liveConnections !== null ? liveConnections.length : (member.connections_count || 0)} connections
                  </span>
                </button>

                <div className="li-profile-card__actions">
                  {isOwnProfile ? (
                    <>
                      <button type="button" className="li-btn-open-to" onClick={() => setModal('headline')}>
                        Open to
                      </button>
                      <button type="button" className="li-btn-add-section" onClick={() => setModal('about')}>
                        Add section
                      </button>
                    </>
                  ) : (
                    <>
                      {connStatus === 'accepted' ? (
                        <button type="button" className="li-btn-connect" disabled style={{ opacity: 0.75 }}>
                          ✓ Connected
                        </button>
                      ) : connStatus === 'pending_sent' ? (
                        <button type="button" className="li-btn-connect" disabled style={{ opacity: 0.65 }}>
                          Pending…
                        </button>
                      ) : connStatus === 'pending_received' ? (
                        <button type="button" className="li-btn-connect" onClick={handleConnect} disabled={connLoading}>
                          Accept
                        </button>
                      ) : (
                        <button type="button" className="li-btn-connect" onClick={handleConnect} disabled={connLoading}>
                          {connLoading ? '…' : '+ Connect'}
                        </button>
                      )}
                      <button type="button" className="li-btn-message" onClick={handleMessage} disabled={msgLoading}>
                        {msgLoading ? 'Opening…' : 'Message'}
                      </button>
                      <button type="button" className="li-btn-more" onClick={() => setFollowing(f => !f)}>
                        {following ? '✓ Following' : 'Follow'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        {(member.about_summary || isOwnProfile) && (
          <div className="li-profile-section">
            <div className="li-profile-section__header">
              <h2 className="li-profile-section__title">About</h2>
              {isOwnProfile && (
                <button type="button" className="li-profile-icon-btn" aria-label="Edit about" title="Edit about" onClick={() => setModal('about')}>
                  <EditIcon />
                </button>
              )}
            </div>
            {member.about_summary
              ? <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6, margin: 0 }}>{member.about_summary}</p>
              : <p style={{ fontSize: 14, color: '#56687A', margin: 0 }}>No summary yet.{' '}<button type="button" className="li-profile-inline-link" onClick={() => setModal('about')}>Add about</button></p>
            }
          </div>
        )}

        {/* Experience */}
        <div className="li-profile-section">
          <div className="li-profile-section__header">
            <h2 className="li-profile-section__title">Experience</h2>
            {isOwnProfile && (
              <div className="li-profile-section__tools">
                <button type="button" className="li-profile-icon-btn" aria-label="Add experience" title="Add experience" onClick={() => setModal('experience')}>
                  <PlusIcon />
                </button>
                <button type="button" className="li-profile-icon-btn" aria-label="Edit experience" title="Edit experience" onClick={() => setModal('experience')}>
                  <EditIcon />
                </button>
              </div>
            )}
          </div>
          {experience.length > 0 ? (
            experience.map((exp, i) => (
              <div key={i} className="li-exp-item">
                <div className="li-exp-logo">{(exp.company || exp.title || '?')[0].toUpperCase()}</div>
                <div className="li-exp-body">
                  <h4>{exp.title || exp.role || 'Position'}</h4>
                  <p className="li-exp-company">{exp.company || exp.organization || ''}</p>
                  {(exp.start_date || exp.duration) && (
                    <p className="li-exp-duration">
                      {exp.start_date || ''}{exp.end_date ? ` – ${exp.end_date}` : exp.start_date ? ' – Present' : ''}
                      {exp.duration ? ` · ${exp.duration}` : ''}
                    </p>
                  )}
                  {exp.description && <p className="li-exp-desc">{exp.description}</p>}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 14, color: '#56687A', margin: 0 }}>
              No experience listed.{' '}
              {isOwnProfile && (
                <button type="button" className="li-profile-inline-link" onClick={() => setModal('experience')}>
                  Add experience
                </button>
              )}
            </p>
          )}
        </div>

        {/* Education */}
        <div className="li-profile-section">
          <div className="li-profile-section__header">
            <h2 className="li-profile-section__title">Education</h2>
            {isOwnProfile && (
              <div className="li-profile-section__tools">
                <button type="button" className="li-profile-icon-btn" aria-label="Add education" title="Add education" onClick={() => setModal('education')}>
                  <PlusIcon />
                </button>
                <button type="button" className="li-profile-icon-btn" aria-label="Edit education" title="Edit education" onClick={() => setModal('education')}>
                  <EditIcon />
                </button>
              </div>
            )}
          </div>
          {education.length > 0 ? (
            education.map((edu, i) => (
              <div key={i} className="li-exp-item">
                <div className="li-exp-logo" style={{ background: '#FDF9F5', color: '#915907' }}>
                  {(edu.institution || edu.school || 'U')[0].toUpperCase()}
                </div>
                <div className="li-exp-body">
                  <h4>{edu.institution || edu.school || 'Institution'}</h4>
                  <p className="li-exp-company">{[edu.degree, edu.field_of_study].filter(Boolean).join(', ') || edu.degree || ''}</p>
                  {(edu.start_year || edu.end_year || edu.graduation_year) && (
                    <p className="li-exp-duration">
                      {edu.start_year || ''}{edu.end_year ? ` – ${edu.end_year}` : edu.graduation_year ? ` – ${edu.graduation_year}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 14, color: '#56687A', margin: 0 }}>
              No education listed.{' '}
              {isOwnProfile && (
                <button type="button" className="li-profile-inline-link" onClick={() => setModal('education')}>
                  Add education
                </button>
              )}
            </p>
          )}
        </div>

        {/* Skills */}
        <div className="li-profile-section">
          <div className="li-profile-section__header">
            <h2 className="li-profile-section__title">Skills</h2>
            {isOwnProfile && (
              <div className="li-profile-section__tools">
                <button type="button" className="li-profile-icon-btn" aria-label="Add skill" title="Add skill" onClick={() => setModal('skills')}>
                  <PlusIcon />
                </button>
                <button type="button" className="li-profile-icon-btn" aria-label="Edit skills" title="Edit skills" onClick={() => setModal('skills')}>
                  <EditIcon />
                </button>
              </div>
            )}
          </div>
          {skills.length > 0 ? (
            <div className="li-skill-tags">
              {skills.map(s => <span key={s} className="li-skill-tag">{s}</span>)}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: '#56687A', margin: 0 }}>
              No skills listed.{' '}
              {isOwnProfile && (
                <button type="button" className="li-profile-inline-link" onClick={() => setModal('skills')}>
                  Add skills
                </button>
              )}
            </p>
          )}
        </div>

        {/* Contact info */}
        <div className="li-profile-section">
          <div className="li-profile-section__header">
            <h2 className="li-profile-section__title" style={{ marginBottom: 0 }}>Contact info</h2>
            {isOwnProfile && (
              <button type="button" className="li-profile-icon-btn" aria-label="Edit contact info" title="Edit contact info" onClick={() => setModal('contact')}>
                <EditIcon />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {member.email && (
              <div style={{ fontSize: 14 }}>
                <strong style={{ color: 'rgba(0,0,0,0.9)' }}>Email</strong><br />
                <a href={`mailto:${member.email}`} style={{ color: '#0A66C2' }}>{member.email}</a>
              </div>
            )}
            {member.phone && (
              <div style={{ fontSize: 14 }}>
                <strong style={{ color: 'rgba(0,0,0,0.9)' }}>Phone</strong><br />
                <span style={{ color: 'rgba(0,0,0,0.6)' }}>{member.phone}</span>
              </div>
            )}
            {location && (
              <div style={{ fontSize: 14 }}>
                <strong style={{ color: 'rgba(0,0,0,0.9)' }}>Location</strong><br />
                <span style={{ color: 'rgba(0,0,0,0.6)' }}>{location}</span>
              </div>
            )}
            {isOwnProfile && !location && (
              <div style={{ fontSize: 14 }}>
                <strong style={{ color: 'rgba(0,0,0,0.9)' }}>Location</strong><br />
                <button type="button" className="li-profile-inline-link" onClick={() => setModal('contact')}>
                  Add location
                </button>
              </div>
            )}
          </div>
          {isOwnProfile && (
            <div className="li-profile-contact-footer">
              <button type="button" className="li-profile-delete-account" onClick={handleDelete}>
                Delete profile
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── ASIDE COLUMN ── */}
      <div className="li-profile__aside">
        <div className="li-aside-card">
          <h3 className="li-aside-card__title">People you may know</h3>
          {SUGGESTED.map(p => (
            <div key={p.name} className="li-aside-person">
              <div className="li-aside-avatar" style={{ background: avatarColor(p.name) }}>{p.initial}</div>
              <div className="li-aside-person-info">
                <h4>{p.name}</h4>
                <p>{p.headline}</p>
              </div>
              <button className="li-aside-connect-btn">+ Follow</button>
            </div>
          ))}
        </div>
        <div className="li-aside-card" style={{ fontSize: 12, color: '#56687A', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {['About','Accessibility','Help Center','Privacy & Terms','Ad Choices','Advertising','Business Services'].map(l => (
              <span key={l} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{l}</span>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>LinkedIn Corporation © 2026</div>
        </div>
      </div>

      {/* ── SECTION MODALS ── */}
      {modal === 'headline' && (
        <HeadlineModal memberId={memberId} initial={member.headline} onSaved={onSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'about' && (
        <AboutModal memberId={memberId} initial={member.about_summary} onSaved={onSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'experience' && (
        <ExperienceModal memberId={memberId} initial={experience} onSaved={onSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'education' && (
        <EducationModal memberId={memberId} initial={education} onSaved={onSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'skills' && (
        <SkillsModal memberId={memberId} initial={skills} onSaved={onSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'contact' && (
        <ContactModal
          memberId={memberId}
          initial={{
            email: member.email,
            phone: member.phone,
            city: member.city,
            state: member.state,
            country: member.country,
          }}
          onSaved={onSaved}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── CONNECTIONS MODAL ── */}
      {connModalOpen && (
        <div
          onClick={() => setConnModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10040,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: '100%', maxWidth: 480,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #CACCCE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}&apos;s Connections</div>
                <div style={{ fontSize: 13, color: '#56687A' }}>
                  {liveConnections ? liveConnections.length : 0} connection{liveConnections?.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => setConnModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#56687A', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Connection list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!liveConnections || liveConnections.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#56687A', fontSize: 14 }}>
                  No connections yet.
                </div>
              ) : (
                liveConnections.map(conn => {
                  const cid = conn.connected_user_id
                  const m = connProfiles[cid]
                  const name = m ? `${m.first_name} ${m.last_name}`.trim() : cid
                  const initChar = name.charAt(0).toUpperCase()
                  return (
                    <Link
                      key={cid}
                      to={`/members/${cid}`}
                      onClick={() => setConnModalOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', textDecoration: 'none', borderBottom: '1px solid #F3F2EF', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F3F2EF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: m?.profile_photo_url ? 'transparent' : avatarColor(name),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 18, color: '#fff', overflow: 'hidden',
                      }}>
                        {m?.profile_photo_url
                          ? <img src={resolveUploadUrl(m.profile_photo_url)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initChar}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        {m?.headline && <div style={{ fontSize: 12, color: '#56687A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.headline}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: '#0A66C2', fontWeight: 600, flexShrink: 0 }}>View →</span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
