/** Title-case display names (LinkedIn-style). */
export function formatDisplayName(first = '', last = '') {
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '')
  return `${cap(String(first))} ${cap(String(last))}`.trim() || 'Member'
}

/** City, state, country for profile sidebar (auth / member objects). */
export function formatMemberLocation(m) {
  if (!m) return ''
  const parts = [m.city, m.state, m.country].filter((p) => p && String(p).trim())
  return parts.join(', ')
}

/** Company-ish token after @ in the first segment of headline, e.g. "Incoming @ JPMorganChase | …". */
export function companyHintFromHeadline(headline) {
  if (!headline || typeof headline !== 'string') return ''
  const first = headline.split('|')[0] || headline
  const m = first.match(/@\s*([^\s@|]+)/)
  return m ? m[1].trim() : ''
}
