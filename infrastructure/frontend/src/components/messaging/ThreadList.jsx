import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMessages } from '../../services/api';
import './ThreadList.css';

const AVATAR_COLORS = ['#0a66c2', '#057642', '#b24020', '#915907', '#5f4b8b', '#c37d16', '#1b6f72'];

function avatarColor(userId = '') {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ThreadList = ({ threads, memberMap = {}, selectedThreadId, onSelectThread, currentUserId }) => {
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    threads.forEach(async (thread) => {
      try {
        const data = await listMessages(thread.thread_id);
        if (data.messages && data.messages.length > 0) {
          const last = data.messages[data.messages.length - 1];
          const senderName = last.sender_id === currentUserId
            ? 'You'
            : (memberMap[last.sender_id]?.name || last.sender_name || last.sender_id);
          setPreviews(prev => ({
            ...prev,
            [thread.thread_id]: `${senderName}: ${last.message_text}`,
          }));
        }
      } catch { /* ignore */ }
    });
  }, [threads, currentUserId, memberMap]);

  const getOtherParticipant = (thread) => {
    return thread.participants.find(p => p.user_id !== currentUserId)
      || { user_id: 'Unknown' };
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="thread-list">
      {threads.map((thread, idx) => {
        const other = getOtherParticipant(thread);
        const info = memberMap[other.user_id];
        const displayName = info?.name || other.name || other.user_id;
        const photoUrl = info?.photo;
        const isSelected = thread.thread_id === selectedThreadId;
        const isOnline = idx < 2;

        return (
          <div
            key={thread.thread_id}
            className={`thread-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectThread(thread.thread_id)}
          >
            <div className="thread-avatar-wrapper">
              <Link
                to={`/members/${other.user_id}`}
                onClick={e => e.stopPropagation()}
                style={{ display: 'block', borderRadius: '50%' }}
              >
                <div
                  className="thread-avatar"
                  style={photoUrl ? {} : { backgroundColor: avatarColor(other.user_id) }}
                >
                  {photoUrl
                    ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : displayName.charAt(0).toUpperCase()}
                </div>
              </Link>
              {isOnline && <div className="online-dot" />}
            </div>
            <div className="thread-content">
              <div className="thread-top-row">
                <Link
                  to={`/members/${other.user_id}`}
                  className="thread-name"
                  onClick={e => e.stopPropagation()}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {displayName}
                </Link>
                <span className="thread-time">{formatTime(thread.last_message_at)}</span>
              </div>
              <div className="thread-preview">
                {previews[thread.thread_id] || `${thread.message_count} messages`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ThreadList;
