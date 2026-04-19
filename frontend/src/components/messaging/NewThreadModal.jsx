import React, { useState } from 'react';
import { openThread } from '../../services/api';
import './NewThreadModal.css';

const NewThreadModal = ({ currentUserId, onClose, onThreadCreated }) => {
  const [recipientId, setRecipientId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipientId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await openThread([currentUserId, recipientId.trim()]);
      onThreadCreated(data.thread_id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create thread';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Message</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Recipient User ID</label>
            <input
              type="text"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="e.g., M002 or R001"
              autoFocus
            />
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-create" disabled={!recipientId.trim() || loading}>
              {loading ? 'Creating...' : 'Start Conversation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewThreadModal;
