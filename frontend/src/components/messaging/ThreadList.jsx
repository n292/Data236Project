import React, { useEffect, useState } from 'react';
import { listMessages } from '../../services/api';
import './ThreadList.css';

const AVATAR_COLORS = ['#0a66c2', '#057642', '#b24020', '#915907', '#5f4b8b', '#c37d16', '#1b6f72'];

const ThreadList = ({ threads, selectedThreadId, onSelectThread, currentUserId }) => {
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    threads.forEach(async (thread) => {
      try {
        const data = await listMessages(thread.thread_id);
        if (data.messages && data.messages.length > 0) {
          const last = data.messages[data.messages.length - 1];
          setPreviews(prev => ({
            ...prev,
            [thread.thread_id]: {
              text: last.sender_id === currentUserId
                ? `You: ${last.message_text}`
                : last.message_text,
              sender: last.sender_name || last.sender_id
            }
          }));
        }
      } catch (e) { /* ignore */ }
    });
  }, [threads, currentUserId]);

  const getOtherParticipant = (thread) => {
    const other = thread.participants.find(p => p.user_id !== currentUserId);
    return other || { user_id: 'Unknown', name: 'Unknown User', role: 'member' };
  };

  const getAvatarColor = (userId) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) return 'Yesterday';
    else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="thread-list">
      {threads.map((thread, idx) => {
        const other = getOtherParticipant(thread);
        const isSelected = thread.thread_id === selectedThreadId;
        const preview = previews[thread.thread_id];
        const displayName = other.name || other.user_id;
        const isOnline = idx < 2; // Simulate online for first 2

        return (
          <div
            key={thread.thread_id}
            className={`thread-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectThread(thread.thread_id)}
          >
            <div className="thread-avatar-wrapper">
              <div
                className="thread-avatar"
                style={{ backgroundColor: getAvatarColor(other.user_id) }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              {isOnline && <div className="online-dot" />}
            </div>
            <div className="thread-content">
              <div className="thread-top-row">
                <span className="thread-name">{displayName}</span>
                <span className="thread-time">{formatTime(thread.last_message_at)}</span>
              </div>
              <div className="thread-preview">
                {preview ? preview.text : `${thread.message_count} messages`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ThreadList;
