import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiLogin, apiMe, apiRegister } from '../api/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setUser(null); return }
    apiMe()
      .then(d => setUser(d.user))
      .catch(() => { localStorage.removeItem('token'); setUser(null) })
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password)
    localStorage.setItem('token', data.token)
    try {
      const me = await apiMe()
      setUser(me.user)
      if (me.user?.member_id) localStorage.setItem('viewer_id', me.user.member_id)
      return me.user
    } catch (e) {
      localStorage.removeItem('token')
      localStorage.removeItem('viewer_id')
      throw new Error(
        e.message || 'Could not load your profile after sign-in. Restart the profile-service (migrations run on startup) and try again.'
      )
    }
  }, [])

  const register = useCallback(async (firstName, lastName, email, password, role = 'member') => {
    const data = await apiRegister(firstName, lastName, email, password, role)
    localStorage.setItem('token', data.token)
    try {
      const me = await apiMe()
      setUser(me.user)
      if (me.user?.member_id) localStorage.setItem('viewer_id', me.user.member_id)
      return me.user
    } catch (e) {
      localStorage.removeItem('token')
      localStorage.removeItem('viewer_id')
      throw new Error(
        e.message || 'Account created but profile could not be loaded. Restart the profile-service and try signing in.'
      )
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('viewer_id')
    localStorage.removeItem('recruiter_id')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setUser(null)
      return
    }
    try {
      const me = await apiMe()
      setUser(me.user)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
