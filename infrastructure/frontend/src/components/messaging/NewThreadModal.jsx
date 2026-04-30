import React, { useState, useEffect, useRef } from 'react';
import { openThread } from '../../services/api';
import { searchMembers } from '../../api/memberApi';
import './NewThreadModal.css';

const AVATAR_COLORS = ['#0a66c2','#057642','#b24020','#915907','#5f4b8b','#c37d16','#1b6f72'];
function avatarColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(first = '', last = '') {
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?';
}

const NewThreadModal = ({ currentUserId, onClose, onThreadCreated }) => {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [searching, setSearching]   = useState(false);
  const [showDrop, setShowDrop]     = useState(false);
  const [message, setMessage]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (selected) return;
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchMembers({ keyword: query.trim(), limit: 8 });
        const list = (data.members || []).filter(m => m.member_id !== currentUserId);
        setResults(list);
        setShowDrop(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 280);
  }, [query, selected, currentUserId]);

  const pick = (member) => {
    setSelected(member);
    setQuery(`${member.first_name} ${member.last_name}`);
    setShowDrop(false);
    setResults([]);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setShowDrop(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await openThread([currentUserId, selected.member_id]);
      // Send initial message if provided
      if (message.trim()) {
        try {
          await fetch('/api/messaging/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              thread_id: data.thread_id,
              sender_id: currentUserId,
              message_text: message.trim(),
            }),
          });
        } catch { /* non-fatal */ }
      }
      onThreadCreated(data.thread_id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start conversation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ntm-content" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2>New Message</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* To: field */}
        <div className="ntm-to-row">
          <span className="ntm-to-label">To</span>

          {selected ? (
            <div className="ntm-selected-chip">
              <div className="ntm-chip-avatar" style={{ background: avatarColor(selected.member_id) }}>
                {selected.profile_photo_url
                  ? <img src={selected.profile_photo_url} alt="" />
                  : initials(selected.first_name, selected.last_name)}
              </div>
              <span className="ntm-chip-name">{selected.first_name} {selected.last_name}</span>
              <button className="ntm-chip-remove" onClick={clear}>×</button>
            </div>
          ) : (
            <div className="ntm-search-wrap">
              <input
                ref={inputRef}
                className="ntm-search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => results.length && setShowDrop(true)}
                placeholder="Search by name..."
                autoComplete="off"
              />
              {searching && <span className="ntm-searching-dot" />}

              {showDrop && results.length > 0 && (
                <div className="ntm-dropdown">
                  {results.map(m => (
                    <div key={m.member_id} className="ntm-result" onMouseDown={() => pick(m)}>
                      <div className="ntm-result-avatar" style={{ background: avatarColor(m.member_id) }}>
                        {m.profile_photo_url
                          ? <img src={m.profile_photo_url} alt="" />
                          : initials(m.first_name, m.last_name)}
                      </div>
                      <div className="ntm-result-info">
                        <div className="ntm-result-name">{m.first_name} {m.last_name}</div>
                        {m.headline && <div className="ntm-result-headline">{m.headline}</div>}
                        {(m.city || m.state) && (
                          <div className="ntm-result-loc">{[m.city, m.state].filter(Boolean).join(', ')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showDrop && !searching && query.trim().length >= 2 && results.length === 0 && (
                <div className="ntm-dropdown ntm-no-results">No members found for "{query}"</div>
              )}
            </div>
          )}
        </div>

        {/* Message box — only show once someone is selected */}
        {selected && (
          <div className="ntm-message-wrap">
            <textarea
              className="ntm-message-input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Write a message to ${selected.first_name}…`}
              rows={4}
              autoFocus
            />
          </div>
        )}

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-create"
            onClick={handleSubmit}
            disabled={!selected || submitting}
          >
            {submitting ? 'Starting…' : 'Start conversation'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default NewThreadModal;
