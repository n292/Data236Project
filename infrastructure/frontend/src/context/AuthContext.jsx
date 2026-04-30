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
    const me = await apiMe()
    setUser(me.user)
    if (me.user?.member_id) localStorage.setItem('viewer_id', me.user.member_id)
    return me.user
  }, [])

  const register = useCallback(async (firstName, lastName, email, password, role = 'member') => {
    const data = await apiRegister(firstName, lastName, email, password, role)
    localStorage.setItem('token', data.token)
    const me = await apiMe()
    setUser(me.user)
    if (me.user?.member_id) localStorage.setItem('viewer_id', me.user.member_id)
    return me.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('viewer_id')
    localStorage.removeItem('recruiter_id')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
