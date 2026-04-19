import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CreateProfilePage from './pages/CreateProfilePage'
import SearchMembersPage from './pages/SearchMembersPage'
import MemberDetailPage from './pages/MemberDetailPage'
import EditProfilePage from './pages/EditProfilePage'

// M4 — Messaging & Connections
import MessagingPage from './pages/Messaging/MessagingPage'
import ConnectionsPage from './pages/Connections/ConnectionsPage'
import FeedPage from './pages/Home/HomePage'

import { ToastProvider } from './components/common/Toast'

export default function App() {
  const currentUserId = 'M001'
  const currentUserName = 'Rajesh Paruchuri'

  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/members/create" element={<CreateProfilePage />} />
          <Route path="/members/search" element={<SearchMembersPage />} />
          <Route path="/members/:memberId" element={<MemberDetailPage />} />
          <Route path="/members/:memberId/edit" element={<EditProfilePage />} />

          {/* M4 Routes */}
          <Route path="/messaging" element={<MessagingPage currentUserId={currentUserId} currentUserName={currentUserName} />} />
          <Route path="/connections" element={<ConnectionsPage currentUserId={currentUserId} />} />
          <Route path="/feed" element={<FeedPage currentUserName={currentUserName} />} />
        </Routes>
      </Layout>
    </ToastProvider>
  )
}
