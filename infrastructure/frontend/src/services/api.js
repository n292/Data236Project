import axios from 'axios';

const MESSAGING_API = import.meta.env.VITE_MESSAGING_API || '/api/messaging';
const CONNECTION_API = import.meta.env.VITE_CONNECTION_API || '/api/connections';

// ==================== MESSAGING API ====================

export const openThread = async (participantIds) => {
  const res = await axios.post(`${MESSAGING_API}/threads/open`, {
    participant_ids: participantIds
  });
  return res.data;
};

export const getThread = async (threadId) => {
  const res = await axios.post(`${MESSAGING_API}/threads/get`, {
    thread_id: threadId
  });
  return res.data;
};

export const getThreadsByUser = async (userId) => {
  const res = await axios.post(`${MESSAGING_API}/threads/byUser`, {
    user_id: userId
  });
  return res.data;
};

export const listMessages = async (threadId) => {
  const res = await axios.post(`${MESSAGING_API}/messages/list`, {
    thread_id: threadId
  });
  return res.data;
};

export const sendMessage = async (threadId, senderId, senderName, messageText) => {
  const res = await axios.post(`${MESSAGING_API}/messages/send`, {
    thread_id: threadId,
    sender_id: senderId,
    sender_name: senderName,
    message_text: messageText,
    idempotency_key: crypto.randomUUID()
  });
  return res.data;
};

// ==================== CONNECTION API ====================

export const requestConnection = async (requesterId, receiverId) => {
  const res = await axios.post(`${CONNECTION_API}/request`, {
    requester_id: requesterId,
    receiver_id: receiverId
  });
  return res.data;
};

export const acceptConnection = async (connectionId) => {
  const res = await axios.post(`${CONNECTION_API}/accept`, {
    connection_id: connectionId
  });
  return res.data;
};

export const rejectConnection = async (connectionId) => {
  const res = await axios.post(`${CONNECTION_API}/reject`, {
    connection_id: connectionId
  });
  return res.data;
};

export const listConnections = async (userId, status = null) => {
  const body = { user_id: userId };
  if (status) body.status = status;
  const res = await axios.post(`${CONNECTION_API}/list`, body);
  return res.data;
};

export const getMutualConnections = async (userId1, userId2) => {
  const res = await axios.post(`${CONNECTION_API}/mutual`, {
    user_id_1: userId1,
    user_id_2: userId2
  });
  return res.data;
};
