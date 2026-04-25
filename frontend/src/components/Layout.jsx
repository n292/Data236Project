import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#56687A" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function HomeIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill={active ? "#000" : "none"} stroke={active ? "none" : "#56687A"} strokeWidth="1.5">
      <path d="M9.005 16.545a2.997 2.997 0 012.997-2.997A2.997 2.997 0 0115 16.545V22h7V11.543L12 2 2 11.543V22h7.005z"/>
    </svg>
  )
}

function PeopleIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={active ? "#000" : "#56687A"} strokeWidth="1.5">
      <circle cx="12" cy="7" r="4"/>
      <path d="M2 20c0-4 4.5-7 10-7s10 3 10 7"/>
    </svg>
  )
}

function BriefcaseIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={active ? "#000" : "#56687A"} strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    </svg>
  )
}

function ClipboardIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={active ? "#000" : "#56687A"} strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  )
}

const navItems = [
  { to: "/",                     label: "Home",              Icon: HomeIcon      },
  { to: "/members/search",       label: "My Network",        Icon: PeopleIcon    },
  { to: "/applications/apply",   label: "Jobs",              Icon: BriefcaseIcon },
  { to: "/applications/review",  label: "Review",            Icon: ClipboardIcon },
]

export default function Layout({ children }) {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  function handleSearch(e) {
    e.preventDefault()
    if (search.trim()) navigate(`/members/search?keyword=${encodeURIComponent(search.trim())}`)
  }

  return (
    <div style={{ background: '#F3F2EF', minHeight: '100vh' }}>

      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #CACCCE',
        position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{
          maxWidth: 1128, margin: '0 auto', padding: '0 16px',
          display: 'flex', alignItems: 'center',
          height: 52, gap: 8,
        }}>

          {/* "in" logo */}
          <Link to="/" style={{ flexShrink: 0, textDecoration: 'none', marginRight: 4 }}>
            <div style={{
              width: 34, height: 34, background: '#0A66C2', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 900, fontSize: 22,
              fontFamily: 'Georgia, serif', letterSpacing: -1,
            }}>in</div>
          </Link>

          {/* Search bar — pill shape, white, with border */}
          <form onSubmit={handleSearch} style={{
            display: 'flex', alignItems: 'center',
            background: '#EEF3F8',
            border: '1px solid #CACCCE',
            borderRadius: 400,
            padding: '0 14px', gap: 8,
            height: 34, width: 260, flexShrink: 0,
          }}>
            <SearchIcon />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 14, color: '#38434F', width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </form>

          <div style={{ flex: 1 }} />

          {/* Icon-only nav — no text labels, just like the screenshot */}
          <nav style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
            {navItems.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} title={label}
                style={({ isActive }) => ({
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '0 14px', textDecoration: 'none', gap: 2,
                  color: isActive ? '#000000' : '#56687A',
                  borderBottom: isActive ? '2px solid #000' : '2px solid transparent',
                  minWidth: 56, transition: 'color 0.1s', position: 'relative',
                })}>
                {({ isActive }) => (
                  <>
                    <Icon active={isActive} />
                    <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? '#000' : '#56687A' }}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

        </div>
      </header>

      <main style={{ maxWidth: 1128, margin: '0 auto', padding: '24px 16px' }}>
        {children}
      </main>

    </div>
  )
}