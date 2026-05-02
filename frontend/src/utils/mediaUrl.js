/**
 * Normalize profile/banner image URLs so they load from the current app origin
 * (Vite or nginx proxy), not from an internal API host:port.
 */
export function resolveUploadUrl(url) {
  if (url == null || url === '') return url
  const s = String(url).trim()
  if (s.startsWith('/')) return s.split('?')[0]
  const idx = s.indexOf('/uploads/')
  if (idx !== -1) return s.slice(idx).split('?')[0]
  return s.split('?')[0]
}
