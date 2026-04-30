import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listMessages, sendMessage, getThread } from '../../services/api';
import './ThreadDetail.css';

const AVATAR_COLORS = ['#0a66c2', '#057642', '#b24020', '#915907', '#5f4b8b', '#c37d16', '#1b6f72'];

function avatarColor(userId = '') {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ThreadDetail = ({ threadId, currentUserId, currentUserName, memberMap = {}, onMessageSent }) => {
  const [messages, setMessages] = useState([]);
  const [threadInfo, setThreadInfo] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const [msgData, threadData] = await Promise.all([
        listMessages(threadId),
        getThread(threadId)
      ]);
      setMessages(msgData.messages || []);
      setThreadInfo(threadData);
      setError(null);
    } catch {
      setError('Failed to load messages');
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    setError(null);
    let attempts = 0;
    while (attempts < 3) {
      try {
        await sendMessage(threadId, currentUserId, currentUserName, newMessage.trim());
        setNewMessage('');
        await fetchMessages();
        if (onMessageSent) onMessageSent();
        break;
      } catch {
        attempts++;
        if (attempts >= 3) setError('Failed to send. Please try again.');
        else await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const getOtherParticipant = () => {
    if (!threadInfo) return null;
    return threadInfo.participants?.find(p => p.user_id !== currentUserId) || null;
  };

  const other = getOtherParticipant();
  const otherId = other?.user_id || '';
  const otherInfo = memberMap[otherId];
  const otherName = otherInfo?.name || other?.name || otherId;
  const otherPhoto = otherInfo?.photo || null;

  const resolveSender = (msg) => {
    if (msg.sender_id === currentUserId) {
      return { name: currentUserName, photo: null };
    }
    const info = memberMap[msg.sender_id];
    return {
      name: info?.name || msg.sender_name || msg.sender_id,
      photo: info?.photo || null,
    };
  };

  const formatMsgTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'YESTERDAY';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const getDateLabel = (msg, idx) => {
    if (idx === 0) return formatDateLabel(msg.timestamp);
    const prev = new Date(messages[idx - 1].timestamp).toDateString();
    const cur = new Date(msg.timestamp).toDateString();
    return prev !== cur ? formatDateLabel(msg.timestamp) : null;
  };

  return (
    <div className="chat-detail">
      <div className="chat-header">
        <div className="chat-header-left">
          <Link to={`/members/${otherId}`} style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}>
            <div className="chat-header-avatar" style={otherPhoto ? { padding: 0, overflow: 'hidden' } : { background: avatarColor(otherId) }}>
              {otherPhoto
                ? <img src={otherPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : otherName.charAt(0).toUpperCase()}
            </div>
          </Link>
          <div className="chat-header-info">
            <Link to={`/members/${otherId}`} className="chat-header-name" style={{ color: 'inherit', textDecoration: 'none' }}>
              {otherName}
            </Link>
            <div className="chat-header-status">
              <span className="status-dot" /> Active now
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" title="More">&#8943;</button>
          <button className="icon-btn" title="Star">&#9734;</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>This is the beginning of your conversation with <strong>{otherName}</strong></p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const dateLabel = getDateLabel(msg, idx);
          const isSent = msg.sender_id === currentUserId;
          const sender = resolveSender(msg);
          return (
            <React.Fragment key={msg.message_id}>
              {dateLabel && <div className="date-divider"><span>{dateLabel}</span></div>}
              <div className={`chat-msg ${isSent ? 'sent' : 'received'}`}>
                {!isSent && (
                  <div className="msg-avatar" style={sender.photo ? { padding: 0, overflow: 'hidden' } : { background: avatarColor(msg.sender_id) }}>
                    {sender.photo
                      ? <img src={sender.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : sender.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="msg-content">
                  <div className="msg-sender-row">
                    <span className="msg-sender-name">{sender.name}</span>
                    <span className="msg-time">{formatMsgTime(msg.timestamp)}</span>
                  </div>
                  <div className="msg-bubble">{msg.message_text}</div>
                </div>
                {isSent && <div className="msg-sent-indicator">&#10004;</div>}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-compose">
        <div className="compose-box">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={2}
            disabled={sending}
          />
          <div className="compose-toolbar">
            <div className="compose-tools">
              <button className="tool-btn" title="Image">&#128247;</button>
              <button className="tool-btn" title="Attach">&#128206;</button>
              <button className="tool-btn" title="GIF">GIF</button>
              <button className="tool-btn" title="Emoji">&#128578;</button>
            </div>
            <div className="compose-send-hint">
              {sending ? 'Sending...' : 'Press Enter to Send'}
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                title="Send"
              >
                &#10148;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadDetail;
