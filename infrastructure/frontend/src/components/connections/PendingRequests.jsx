import React, { useState } from 'react';
import { acceptConnection, rejectConnection } from '../../services/api';
import { useToast } from '../common/Toast';
import './PendingRequests.css';

const AVATAR_COLORS = ['#0a66c2', '#057642', '#b24020', '#915907', '#5f4b8b', '#c37d16', '#1b6f72'];

const PendingRequests = ({ requests, currentUserId, onActionComplete }) => {
  const [processingId, setProcessingId] = useState(null);
  const toast = useToast();

  const handleAccept = async (connectionId) => {
    setProcessingId(connectionId);
    try {
      await acceptConnection(connectionId);
      toast('Connection accepted!', 'success');
      onActionComplete();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to accept', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (connectionId) => {
    setProcessingId(connectionId);
    try {
      await rejectConnection(connectionId);
      toast('Invitation ignored', 'info');
      onActionComplete();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  return (
    <div className="invitation-list">
      {requests.map(req => (
        <div key={req.connection_id} className="invitation-row">
          <div
            className="invitation-avatar"
            style={{ backgroundColor: getColor(req.connected_user_id) }}
          >
            {req.connected_user_id.charAt(0).toUpperCase()}
          </div>
          <div className="invitation-info">
            <div className="invitation-name">{req.connected_user_id}</div>
            <div className="invitation-subtitle">
              Wants to connect with you
            </div>
            <div className="invitation-mutual">
              &#128101; Mutual connection
            </div>
          </div>
          <div className="invitation-actions">
            <button
              className="btn-ignore"
              onClick={() => handleReject(req.connection_id)}
              disabled={processingId === req.connection_id}
            >
              Ignore
            </button>
            <button
              className="btn-accept"
              onClick={() => handleAccept(req.connection_id)}
              disabled={processingId === req.connection_id}
            >
              Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingRequests;
