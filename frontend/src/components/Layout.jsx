import { Link, NavLink } from 'react-router-dom'

const LI_BLUE = '#0A66C2'

export default function Layout({ children }) {
  return (
    <div className="page-shell">
      <header className="topbar" style={{ borderBottom: '1px solid #CACCCE', paddingBottom: 12 }}>
        <h1 style={{ color: LI_BLUE, fontSize: 18, margin: 0, fontWeight: 700 }}>
          LinkedIn Simulation
        </h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <NavLink to="/" end style={navStyle}>Home</NavLink>
          <NavLink to="/members/create" style={navStyle}>Create Profile</NavLink>
          <NavLink to="/members/search" style={navStyle}>Search Members</NavLink>

          {/* M3 nav entries */}
          <span style={{ borderLeft: '1px solid #CACCCE', margin: '0 4px' }} />
          <NavLink to="/applications/apply" style={navStyle}>Apply for Job</NavLink>
          <NavLink to="/applications/review" style={navStyle}>Review Applicants</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}

function navStyle({ isActive }) {
  return {
    padding: '6px 14px',
    borderRadius: 24,
    fontSize: 14,
    fontWeight: isActive ? 700 : 400,
    color: isActive ? '#fff' : LI_BLUE,
    background: isActive ? LI_BLUE : 'transparent',
    border: `1px solid ${isActive ? LI_BLUE : '#CACCCE'}`,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }
}