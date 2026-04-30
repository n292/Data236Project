import React, { useState } from 'react';
import { requestConnection } from '../../services/api';
import { useToast } from '../common/Toast';
import './SendRequest.css';

const SendRequest = ({ currentUserId, onRequestSent }) => {
  const [receiverId, setReceiverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!receiverId.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      await requestConnection(currentUserId, receiverId.trim());
      setMessage({ type: 'success', text: `Connection request sent to ${receiverId}!` });
      toast(`Connection request sent to ${receiverId}!`, 'success');
      setReceiverId('');
      onRequestSent();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to send request';
      setMessage({ type: 'error', text: errorMsg });
      toast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="send-req">
      <form onSubmit={handleSubmit} className="send-req-form">
        <div className="send-req-input-wrap">
          <span className="send-req-icon">&#128269;</span>
          <input
            type="text"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            placeholder="Enter User ID (e.g., M002, R001)"
            disabled={loading}
          />
        </div>
        <button type="submit" className="send-req-btn" disabled={!receiverId.trim() || loading}>
          {loading ? 'Sending...' : 'Connect'}
        </button>
      </form>
      {message && (
        <div className={`send-req-msg ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default SendRequest;
