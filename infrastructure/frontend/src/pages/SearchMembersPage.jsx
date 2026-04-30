import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchMembers } from '../api/memberApi'
import { requestConnection, listConnections } from '../services/api'
import { useAuth } from '../context/AuthContext'

const AVATAR_COLORS = ['#004182','#057642','#b24020','#5f4b8b','#c37d16','#1b6f72','#0a66c2']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(fn = '', ln = '') {
  return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'M'
}

const LOCATION_SUGGESTIONS = ['San Jose, CA', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX']
const SKILL_SUGGESTIONS    = ['Python', 'Java', 'JavaScript', 'React', 'Node.js', 'SQL', 'Machine Learning']

export default function SearchMembersPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    keyword: searchParams.get('keyword') || '',
    skill: '',
    location: '',
  })
  const [members, setMembers]       = useState([])
  const [error, setError]           = useState('')
  const [searched, setSearched]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [connStates, setConnStates] = useState({})

  useEffect(() => {
    if (searchParams.get('keyword')) runSearch({ keyword: searchParams.get('keyword'), skill: '', location: '' })
  }, [])

  useEffect(() => {
    if (!user?.member_id || members.length === 0) return
    listConnections(user.member_id).then(data => {
      const map = {}
      for (const c of data.connections || []) {
        if (c.status === 'accepted') map[c.connected_user_id] = 'accepted'
        else if (c.status === 'pending') map[c.connected_user_id] = c.direction === 'sent' ? 'pending_sent' : 'pending_received'
      }
      setConnStates(map)
    }).catch(() => {})
  }, [members, user?.member_id])

  async function runSearch(f) {
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await searchMembers(f)
      setMembers(data.members || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    runSearch(filters)
  }

  async function handleConnect(memberId) {
    if (!user?.member_id) return
    setConnStates(prev => ({ ...prev, [memberId]: 'pending_sent' }))
    try {
      await requestConnection(user.member_id, memberId)
    } catch {
      setConnStates(prev => ({ ...prev, [memberId]: 'none' }))
    }
  }

  return (
    <div className="li-people-page">
      <h1 className="li-people-header">People</h1>

      {/* Search row */}
      <form className="li-people-search-row" onSubmit={handleSubmit}>
        <input
          value={filters.keyword}
          onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
          placeholder="Search by name, headline, or keyword"
        />
        <input
          value={filters.skill}
          onChange={e => setFilters(f => ({ ...f, skill: e.target.value }))}
          placeholder="Skill (e.g. Python)"
          style={{ maxWidth: 180 }}
        />
        <input
          value={filters.location}
          onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
          placeholder="Location"
          style={{ maxWidth: 180 }}
        />
        <button type="submit" className="li-people-search-btn">
          Search
        </button>
      </form>

      {/* Filter chips */}
      <div className="li-people-filters">
        <span style={{ fontSize: 14, color: '#56687A', alignSelf: 'center' }}>Quick filters:</span>
        {LOCATION_SUGGESTIONS.map(l => (
          <button
            key={l}
            type="button"
            className={`li-people-filter-btn${filters.location === l ? ' active' : ''}`}
            onClick={() => {
              const next = { ...filters, location: filters.location === l ? '' : l }
              setFilters(next)
              runSearch(next)
            }}
          >
            {l}
          </button>
        ))}
        {SKILL_SUGGESTIONS.map(s => (
          <button
            key={s}
            type="button"
            className={`li-people-filter-btn${filters.skill === s ? ' active' : ''}`}
            onClick={() => {
              const next = { ...filters, skill: filters.skill === s ? '' : s }
              setFilters(next)
              runSearch(next)
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="alert error-alert">{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#56687A' }}>Loading…</div>
      )}

      {!loading && searched && (
        <p className="li-people-count">
          {members.length} result{members.length !== 1 ? 's' : ''}
          {filters.keyword ? ` for "${filters.keyword}"` : ''}
          {filters.location ? ` in ${filters.location}` : ''}
          {filters.skill ? ` · ${filters.skill}` : ''}
        </p>
      )}

      <div className="li-people-results">
        {!loading && members.length === 0 && searched && (
          <div className="li-people-empty">
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No results found</div>
            <div style={{ fontSize: 14 }}>Try adjusting your search or filters</div>
          </div>
        )}

        {!loading && !searched && (
          <div className="li-people-empty">
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Search for people</div>
            <div style={{ fontSize: 14 }}>Find professionals by name, skill, or location</div>
          </div>
        )}

        {members.map(member => {
          const fullName = `${member.first_name} ${member.last_name}`.trim()
          const location = [member.city, member.state, member.country].filter(Boolean).join(', ')
          const skills   = Array.isArray(member.skills)
            ? member.skills
            : (typeof member.skills === 'string' ? (() => { try { return JSON.parse(member.skills) } catch { return [] } })() : [])
          const connStatus = connStates[member.member_id] || 'none'
          const isOwnCard = user?.member_id === member.member_id
          const color = avatarColor(fullName)

          return (
            <div key={member.member_id} className="li-people-card">
              <div className="li-people-avatar" style={{ background: color }}>
                {member.profile_photo_url
                  ? <img src={member.profile_photo_url} alt={fullName} />
                  : initials(member.first_name, member.last_name)}
              </div>

              <div className="li-people-info">
                <Link to={`/members/${member.member_id}`} className="li-people-info__name">
                  {fullName}
                </Link>
                {member.headline && (
                  <p className="li-people-info__headline">{member.headline}</p>
                )}
                {location && <p className="li-people-info__location">{location}</p>}
                {skills.length > 0 && (
                  <div className="li-people-skills">
                    {skills.slice(0, 4).map(s => (
                      <span key={s} className="li-people-skill">{s}</span>
                    ))}
                    {skills.length > 4 && (
                      <span className="li-people-skill" style={{ background: 'transparent', color: '#56687A' }}>
                        +{skills.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="li-people-card__actions">
                {!isOwnCard && (
                  <button
                    type="button"
                    className="li-people-connect-btn"
                    onClick={() => handleConnect(member.member_id)}
                    disabled={connStatus !== 'none'}
                    style={connStatus !== 'none' ? { background: '#DCE6F1', cursor: 'default' } : {}}
                  >
                    {connStatus === 'accepted' ? '✓ Connected'
                      : connStatus === 'pending_sent' ? 'Pending…'
                      : connStatus === 'pending_received' ? 'Respond'
                      : '+ Connect'}
                  </button>
                )}
                <Link to={`/members/${member.member_id}`} className="li-people-view-btn">
                  View profile
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
