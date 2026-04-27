import { Link } from 'react-router-dom'

export default function Layout({ children }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <h1>LinkedIn Simulation — M1</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/members/create">Create Profile</Link>
          <Link to="/members/search">Search Members</Link>
          <Link to="/analytics/recruiter" style={{ marginRight: "10px" }}>Recruiter Dashboard</Link>
          <Link to="/analytics/member">Member Dashboard</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
