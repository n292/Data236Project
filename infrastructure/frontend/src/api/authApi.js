const BASE = '/api/auth'

async function req(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.message || 'Request failed')
  return data
}

export async function apiRegister(first_name, last_name, email, password, role = 'member') {
  return req('/register', {
    method: 'POST',
    body: JSON.stringify({ first_name, last_name, email, password, role }),
  })
}

export async function apiLogin(email, password) {
  return req('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export async function apiMe() {
  return req('/me')
}
