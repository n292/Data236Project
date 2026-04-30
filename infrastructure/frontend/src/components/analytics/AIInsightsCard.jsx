import { useState, useEffect, useRef } from 'react'
import { streamInsights } from '../../api/geminiApi'

const SPARKLE = '✦'

export default function AIInsightsCard({ systemPrompt, data, title = 'AI Insights', deps = [] }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)
  const abortRef = useRef(false)

  async function generate() {
    abortRef.current = false
    setLoading(true)
    setError('')
    setText('')
    setGenerated(false)
    try {
      for await (const chunk of streamInsights(systemPrompt, data)) {
        if (abortRef.current) break
        setText(prev => prev + chunk)
      }
      setGenerated(true)
    } catch (e) {
      const msg = e?.message || String(e)
      setError(`Error: ${msg}`)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => { abortRef.current = true }
  }, [])

  const lines = text
    .split('\n')
    .map(l => l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>'))

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8f7ff 0%, #eef4fb 100%)',
      border: '1px solid #c9d8f0',
      borderRadius: 10,
      padding: '18px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, #0A66C2, #7c3aed, #0A66C2)',
        backgroundSize: '200% 100%',
        animation: loading ? 'aiSlide 1.5s linear infinite' : 'none',
      }} />

      <style>{`
        @keyframes aiSlide { 0%{background-position:0% 0%} 100%{background-position:200% 0%} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .ai-cursor { display:inline-block; width:2px; height:1em; background:#0A66C2; margin-left:2px; vertical-align:text-bottom; animation: blink 0.8s step-start infinite; }
        .ai-insight-line { margin: 4px 0; font-size: 14px; color: #38434F; line-height: 1.6; }
        .ai-insight-line:empty { display: none; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{SPARKLE}</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1d1d1d' }}>{title}</h3>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#7c3aed',
            background: '#ede9fe', padding: '2px 7px', borderRadius: 999, letterSpacing: 0.5,
          }}>AI</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            background: loading ? '#e5e7eb' : '#0A66C2',
            color: loading ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 999,
            padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Analyzing…' : generated ? 'Refresh' : 'Analyze'}
        </button>
      </div>

      {!generated && !loading && !error && (
        <p style={{ margin: 0, fontSize: 13, color: '#56687A' }}>
          Click <strong>Analyze</strong> to get AI-powered insights based on your data.
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: '#C0392B' }}>{error}</p>
      )}

      {(loading || text) && (
        <div style={{ marginTop: 4 }}>
          {lines.map((line, i) => (
            <p
              key={i}
              className="ai-insight-line"
              dangerouslySetInnerHTML={{ __html: line }}
            />
          ))}
          {loading && <span className="ai-cursor" />}
        </div>
      )}
    </div>
  )
}
