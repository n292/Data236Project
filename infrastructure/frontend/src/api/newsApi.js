const API_KEY = import.meta.env.VITE_NEWS_API_KEY || ''
const BASE = 'https://newsapi.org/v2'

// Tech-focused sources — TechRadar excluded (publishes game hints, sports, entertainment)
const TECH_SOURCES = 'techcrunch,the-verge,wired,ars-technica,hacker-news,engadget'

const NOISE_PATTERNS = [
  /\bhints?\b.*\banswers?\b/i,
  /\bgame\s*#\d+/i,
  /\bwordle\b/i,
  /\bquordle\b/i,
  /\bstrands\b/i,
  /\bconnections\b.*\bnyt\b/i,
  /\bnyt\b.*\bconnections\b/i,
  /\bhow to watch\b/i,
  /\blive stream/i,
  /\bfa cup\b/i,
  /\bpremier league\b/i,
  /\brelease date\b.*\bepisode\b/i,
  /\bepisode\b.*\brelease date\b/i,
  /\bdisney\+\b/i,
  /\bhulu\b/i,
  /\bnetflix\b.*\bseason\b/i,
]

function isTechArticle(article) {
  const text = `${article.title || ''} ${article.description || ''}`
  return !NOISE_PATTERNS.some(re => re.test(text))
}

export async function fetchTechNews({ pageSize = 20 } = {}) {
  if (!API_KEY) return { articles: [], error: 'No API key' }
  try {
    const res = await fetch(
      `${BASE}/top-headlines?sources=${TECH_SOURCES}&pageSize=${pageSize}&apiKey=${API_KEY}`
    )
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
    const data = await res.json()
    const filtered = (data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && isTechArticle(a))
    return { articles: filtered, error: null }
  } catch (e) {
    return { articles: [], error: e.message }
  }
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const RECENT_KEY = 'li_recent_news'

export function getRecentNews() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

export function trackRecentNews(article) {
  try {
    const recent = getRecentNews().filter(a => a.url !== article.url)
    const updated = [{ title: article.title, url: article.url, source: article.source?.name }, ...recent].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch { /* non-fatal */ }
}
