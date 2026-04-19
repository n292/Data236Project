import React from 'react';
import './ConnectionList.css';

const AVATAR_COLORS = ['#0a66c2', '#057642', '#b24020', '#915907', '#5f4b8b', '#c37d16', '#1b6f72'];

const ConnectionList = ({ connections, currentUserId, showStatus = false }) => {
  const getColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  if (connections.length === 0) {
    return <div className="conn-empty">No connections to show</div>;
  }

  return (
    <div className="conn-list">
      {connections.map(conn => (
        <div key={conn.connection_id} className="conn-row">
          <div
            className="conn-avatar"
            style={{ backgroundColor: getColor(conn.connected_user_id) }}
          >
            {conn.connected_user_id.charAt(0).toUpperCase()}
          </div>
          <div className="conn-info">
            <div className="conn-name">{conn.connected_user_id}</div>
            <div className="conn-subtitle">
              Connected {new Date(conn.updated_at).toLocaleDateString([], {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </div>
          </div>
          {showStatus && (
            <span className={`conn-badge badge-${conn.status}`}>
              {conn.status}
            </span>
          )}
          <button className="conn-message-btn">Message</button>
        </div>
      ))}
    </div>
  );
};

export default ConnectionList;
