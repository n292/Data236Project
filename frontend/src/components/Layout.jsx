import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const location = useLocation()

  const isActive = (path) => location.pathname === path ? 'nav-active' : ''

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="topbar-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
              <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
            </svg>
          </Link>
          <nav className="topbar-nav">
            <Link to="/" className={isActive('/')}>Home</Link>
            <Link to="/feed" className={isActive('/feed')}>Feed</Link>
            <Link to="/members/create" className={isActive('/members/create')}>Create Profile</Link>
            <Link to="/members/search" className={isActive('/members/search')}>Search</Link>
            <Link to="/messaging" className={isActive('/messaging')}>Messaging</Link>
            <Link to="/connections" className={isActive('/connections')}>My Network</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
