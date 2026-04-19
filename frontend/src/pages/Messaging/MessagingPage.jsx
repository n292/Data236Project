import React, { useState, useEffect, useCallback } from 'react';
import ThreadList from '../../components/messaging/ThreadList';
import ThreadDetail from '../../components/messaging/ThreadDetail';
import NewThreadModal from '../../components/messaging/NewThreadModal';
import { getThreadsByUser } from '../../services/api';
import './MessagingPage.css';

const MessagingPage = ({ currentUserId = 'M001', currentUserName = 'Rajesh Paruchuri' }) => {
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Focused');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filters = ['Focused', 'Unread', 'Connections', 'InMail', 'Starred'];

  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getThreadsByUser(currentUserId);
      setThreads(data.threads || []);
      setError(null);
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleThreadCreated = (threadId) => {
    setShowNewThread(false);
    setSelectedThreadId(threadId);
    fetchThreads();
  };

  return (
    <div className="messaging-page">
      <div className="messaging-container">
        {/* Left Panel */}
        <div className="messaging-left">
          <div className="messaging-left-header">
            <div className="messaging-title-row">
              <h2>Messaging</h2>
              <div className="messaging-header-actions">
                <button className="icon-btn" title="Filter">&#8943;</button>
                <button className="icon-btn compose-btn" onClick={() => setShowNewThread(true)} title="New message">
                  &#9998;
                </button>
              </div>
            </div>
            <div className="messaging-search">
              <span className="search-icon">&#128269;</span>
              <input type="text" placeholder="Search messages" />
            </div>
            <div className="messaging-filters">
              {filters.map(f => (
                <button
                  key={f}
                  className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f} {f === 'Focused' && '▾'}
                </button>
              ))}
            </div>
          </div>

          <div className="thread-list-container">
            {loading && <div className="loading-state">Loading...</div>}
            {error && <div className="error-state">{error}</div>}
            {!loading && threads.length === 0 && (
              <div className="empty-state">No messages yet. Start a conversation!</div>
            )}
            <ThreadList
              threads={threads}
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
              currentUserId={currentUserId}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="messaging-right">
          {selectedThreadId ? (
            <ThreadDetail
              threadId={selectedThreadId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onMessageSent={fetchThreads}
            />
          ) : (
            <div className="no-conversation">
              <div className="no-conversation-icon">&#128172;</div>
              <h3>Select a conversation</h3>
              <p>Choose from your existing conversations or start a new one.</p>
            </div>
          )}
        </div>
      </div>

      {showNewThread && (
        <NewThreadModal
          currentUserId={currentUserId}
          onClose={() => setShowNewThread(false)}
          onThreadCreated={handleThreadCreated}
        />
      )}
    </div>
  );
};

export default MessagingPage;
