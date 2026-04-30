import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}
function HomeIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9.005 16.545a2.997 2.997 0 012.997-2.997A2.997 2.997 0 0115 16.545V22h7V11.543L12 2 2 11.543V22h7.005z"/></svg>
}
function HomeIconOutline() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.005 16.545a2.997 2.997 0 012.997-2.997A2.997 2.997 0 0115 16.545V22h7V11.543L12 2 2 11.543V22h7.005z"/></svg>
}
function PeopleIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM1.5 21.5a.5.5 0 01-.5-.5c0-3.59 4.24-6.5 8-6.5.61 0 1.21.07 1.79.2A6.53 6.53 0 009 18c0 1.27.36 2.46.98 3.47L10 21.5H1.5z"/><path d="M17 14c2.67 0 8 1.34 8 4v2H9v-2c0-2.66 5.33-4 8-4z" opacity=".6"/></svg>
}
function PeopleIconOutline() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="4"/><path d="M2 20c0-4 4.5-7 10-7s10 3 10 7"/></svg>
}
function BriefcaseIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 6V5a3 3 0 00-3-3h-4a3 3 0 00-3 3v1H2v4l10 2 10-2V6h-5zm-8 0V5a1 1 0 011-1h4a1 1 0 011 1v1H9zM2 16v5h20v-5l-10 2-10-2z"/></svg>
}
function BriefcaseIconOutline() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
}
function MessagingIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 4H8C4.69 4 2 6.69 2 10s2.69 6 6 6v4l4.5-4H16c3.31 0 6-2.69 6-6s-2.69-6-6-6z"/></svg>
}
function MessagingIconOutline() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M22 18.5H2v-1.24c.93-.93 2-2.38 2-5.26 0-2.92 1.56-5.24 4-6.3V4.5A2 2 0 0112 4.5a2 2 0 014 0v1.2c2.44 1.06 4 3.38 4 6.3 0 2.88 1.07 4.33 2 5.26V18.5zM9 20.5a3 3 0 006 0H9z"/></svg>
}
function BellIconOutline() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
}
function ChevronDown() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 10.94L3.47 6.41l.71-.7L8 9.52l3.82-3.81.71.7z"/></svg>
}

const MEMBER_NAV = [
  { to: '/feed',           label: 'Home',        ActiveIcon: HomeIcon,           Icon: HomeIconOutline      },
  { to: '/members/search', label: 'My Network',  ActiveIcon: PeopleIcon,         Icon: PeopleIconOutline    },
  { to: '/jobs',           label: 'Jobs',        ActiveIcon: BriefcaseIcon,      Icon: BriefcaseIconOutline },
  { to: '/messaging',      label: 'Messaging',   ActiveIcon: MessagingIcon,      Icon: MessagingIconOutline },
  { to: '/connections',    label: 'Connections', ActiveIcon: BellIcon,           Icon: BellIconOutline      },
]

const RECRUITER_NAV = [
  { to: '/recruiter/dashboard', label: 'Dashboard',    ActiveIcon: HomeIcon,           Icon: HomeIconOutline      },
  { to: '/recruiter/jobs',      label: 'Jobs',         ActiveIcon: BriefcaseIcon,      Icon: BriefcaseIconOutline },
  { to: '/applications/review', label: 'Applications', ActiveIcon: BellIcon,           Icon: BellIconOutline      },
  { to: '/members/search',      label: 'Talent',       ActiveIcon: PeopleIcon,         Icon: PeopleIconOutline    },
  { to: '/messaging',           label: 'Messaging',    ActiveIcon: MessagingIcon,      Icon: MessagingIconOutline },
]

const MEMBER_ME_ITEMS = [
  { to: '/dashboard',      label: 'Dashboard' },
  { to: '/applications',   label: 'My Applications' },
  { to: '/jobs/saved',     label: 'Saved Jobs' },
  { to: '/career-coach',   label: '🎓 Career Coach (AI)' },
  { to: '/members/create', label: 'Create Profile' },
]

const RECRUITER_ME_ITEMS = [
  { to: '/recruiter/dashboard', label: 'Recruiter Dashboard' },
  { to: '/recruiter/jobs',      label: 'Manage Jobs' },
  { to: '/recruiter/jobs/new',  label: 'Post a Job' },
  { to: '/applications/review', label: 'Review Applications' },
]

export default function Layout({ children }) {
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [meOpen, setMeOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const isRecruiter = user?.role === 'recruiter'
  const NAV_ITEMS = isRecruiter ? RECRUITER_NAV : MEMBER_NAV
  const ME_ITEMS  = isRecruiter ? RECRUITER_ME_ITEMS : MEMBER_ME_ITEMS

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.email : ''
  const initial = displayName ? displayName[0].toUpperCase() : '?'

  function handleSearch(e) {
    e.preventDefault()
    const q = search.trim()
    if (q) navigate(`/members/search?keyword=${encodeURIComponent(q)}`)
  }

  return (
    <div style={{ background: '#F3F2EF', minHeight: '100vh' }}>
      <header className="li-navbar">
        <div className="li-navbar__inner">

          {/* Logo */}
          <Link to="/" className="li-navbar__logo" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="white">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </Link>

          {/* Search */}
          <form
            className="li-navbar__search"
            onSubmit={handleSearch}
            style={searchFocused ? { background: '#fff', border: '1px solid #0A66C2', boxShadow: '0 0 0 1px #0A66C2' } : {}}
          >
            <span className="li-navbar__search-icon" style={{ color: searchFocused ? '#0A66C2' : '#56687A' }}>
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search"
              aria-label="Search"
            />
          </form>

          <div style={{ flex: 1 }} />

          {/* Nav items */}
          <nav className="li-navbar__nav">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === '/feed'}
                className={({ isActive }) => `li-navbar__item${isActive ? ' is-active' : ''}`}>
                <span className="li-navbar__item-icon"><Icon /></span>
                <span className="li-navbar__item-label">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="li-navbar__divider" />

          {/* Me dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="li-navbar__item li-navbar__me"
              onClick={() => setMeOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {user?.profile_photo_url
                ? <img src={user.profile_photo_url} alt={displayName} className="li-navbar__me-photo" />
                : <div className="li-navbar__avatar">{initial}</div>
              }
              <span className="li-navbar__item-label">Me&nbsp;<ChevronDown /></span>
            </button>

            {meOpen && (
              <div className="li-navbar__dropdown" onMouseLeave={() => setMeOpen(false)}>
                {/* User summary */}
                <div className="li-navbar__dropdown-header">
                  <div className="li-navbar__dropdown-avatar">
                    {user?.profile_photo_url
                      ? <img src={user.profile_photo_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : <span>{initial}</span>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {displayName}
                      {isRecruiter && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#0A66C2', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>RECRUITER</span>
                      )}
                    </div>
                    {user?.headline && <div style={{ fontSize: 12, color: '#56687A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.headline}</div>}
                    {user?.member_id && (
                      <Link
                        to={`/members/${user.member_id}`}
                        onClick={() => setMeOpen(false)}
                        className="li-navbar__view-profile-btn"
                      >
                        View Profile
                      </Link>
                    )}
                  </div>
                </div>

                <div className="li-navbar__dropdown-section">
                  {ME_ITEMS.map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMeOpen(false)}
                      className="li-navbar__dropdown-item"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="li-navbar__dropdown-section" style={{ borderBottom: 'none' }}>
                  <button
                    onClick={() => { setMeOpen(false); logout(); navigate('/login') }}
                    className="li-navbar__dropdown-item li-navbar__signout"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      <main className="li-main">
        {children}
      </main>
    </div>
  )
}
