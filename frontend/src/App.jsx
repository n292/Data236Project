import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CreateProfilePage from './pages/CreateProfilePage'
import SearchMembersPage from './pages/SearchMembersPage'
import MemberDetailPage from './pages/MemberDetailPage'
import EditProfilePage from './pages/EditProfilePage'

// M3 — Application Service pages
import ApplyPage from './pages/ApplyPage'
import RecruiterReviewPage from './pages/RecruiterReviewPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* M1 — Profile Service */}
        <Route path="/" element={<HomePage />} />
        <Route path="/members/create" element={<CreateProfilePage />} />
        <Route path="/members/search" element={<SearchMembersPage />} />
        <Route path="/members/:memberId" element={<MemberDetailPage />} />
        <Route path="/members/:memberId/edit" element={<EditProfilePage />} />

        {/* M3 — Application Service */}
        <Route path="/applications/apply" element={<ApplyPage />} />
        <Route path="/applications/review" element={<RecruiterReviewPage />} />
      </Routes>
    </Layout>
  )
}