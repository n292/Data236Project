import React, { useState, useEffect, useCallback } from 'react';
import PendingRequests from '../../components/connections/PendingRequests';
import ConnectionList from '../../components/connections/ConnectionList';
import SendRequest from '../../components/connections/SendRequest';
import { listConnections } from '../../services/api';
import './ConnectionsPage.css';

const ConnectionsPage = ({ currentUserId = 'M001' }) => {
  const [connections, setConnections] = useState([]);
  const [activeTab, setActiveTab] = useState('grow');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listConnections(currentUserId);
      setConnections(data.connections || []);
      setError(null);
    } catch (err) {
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const accepted = connections.filter(c => c.status === 'accepted');
  const pendingReceived = connections.filter(c => c.status === 'pending' && c.direction === 'received');
  const pendingSent = connections.filter(c => c.status === 'pending' && c.direction === 'sent');

  return (
    <div className="network-page">
      {/* Left Sidebar */}
      <div className="network-sidebar">
        <div className="sidebar-card">
          <h3>Manage my network</h3>
          <ul className="sidebar-nav">
            <li>
              <span className="sidebar-icon">&#128101;</span>
              <span>Connections</span>
              <span className="sidebar-count">{accepted.length}</span>
            </li>
            <li>
              <span className="sidebar-icon">&#128100;</span>
              <span>Following & followers</span>
            </li>
            <li>
              <span className="sidebar-icon">&#128101;</span>
              <span>Groups</span>
            </li>
            <li>
              <span className="sidebar-icon">&#128197;</span>
              <span>Events</span>
            </li>
            <li>
              <span className="sidebar-icon">&#128196;</span>
              <span>Pages</span>
            </li>
            <li>
              <span className="sidebar-icon">&#128240;</span>
              <span>Newsletters</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="network-main">
        {/* Tabs */}
        <div className="network-tabs-card">
          <div className="network-tabs">
            <button
              className={`network-tab ${activeTab === 'grow' ? 'active' : ''}`}
              onClick={() => setActiveTab('grow')}
            >
              Grow
            </button>
            <button
              className={`network-tab ${activeTab === 'catchup' ? 'active' : ''}`}
              onClick={() => setActiveTab('catchup')}
            >
              Catch up
            </button>
          </div>
        </div>

        {loading && <div className="network-loading">Loading...</div>}
        {error && <div className="network-error">{error}</div>}

        {activeTab === 'grow' && !loading && (
          <>
            {/* Invitations */}
            <div className="network-card">
              <div className="card-header">
                <span>Invitations ({pendingReceived.length})</span>
                {pendingReceived.length > 0 && (
                  <button className="show-all-btn">Show all</button>
                )}
              </div>
              {pendingReceived.length > 0 ? (
                <PendingRequests
                  requests={pendingReceived}
                  currentUserId={currentUserId}
                  onActionComplete={fetchConnections}
                />
              ) : (
                <div className="card-empty">No pending invitations</div>
              )}
            </div>

            {/* Send Request */}
            <div className="network-card">
              <div className="card-header">
                <span>Connect with someone</span>
              </div>
              <SendRequest
                currentUserId={currentUserId}
                onRequestSent={fetchConnections}
              />
            </div>

            {/* Sent Requests */}
            {pendingSent.length > 0 && (
              <div className="network-card">
                <div className="card-header">
                  <span>Sent requests ({pendingSent.length})</span>
                </div>
                <ConnectionList
                  connections={pendingSent}
                  currentUserId={currentUserId}
                  showStatus
                />
              </div>
            )}

            {/* My Connections */}
            <div className="network-card">
              <div className="card-header">
                <span>My connections ({accepted.length})</span>
              </div>
              {accepted.length > 0 ? (
                <ConnectionList
                  connections={accepted}
                  currentUserId={currentUserId}
                />
              ) : (
                <div className="card-empty">No connections yet. Send a request above!</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'catchup' && (
          <div className="network-card">
            <div className="card-empty" style={{ padding: '60px 20px' }}>
              <p>No catch-up suggestions right now.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionsPage;
