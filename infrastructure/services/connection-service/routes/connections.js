const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/db');
const { publishEvent } = require('../config/kafka');

const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://profile-service:8000';

async function incrementConnectionsCount(memberId) {
  try {
    const res = await fetch(`${PROFILE_SERVICE_URL}/members/${memberId}/increment-connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      console.error(`increment-connections failed for ${memberId}: ${res.status}`);
    }
  } catch (e) {
    console.error(`increment-connections error for ${memberId}:`, e.message);
  }
}

// POST /api/connections/request — Send a connection request
router.post('/request', async (req, res) => {
  try {
    const { requester_id, receiver_id } = req.body;

    if (!requester_id || !receiver_id) {
      return res.status(400).json({
        success: false,
        message: 'requester_id and receiver_id are required'
      });
    }

    if (requester_id === receiver_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send connection request to yourself'
      });
    }

    const pool = getPool();
    const connection_id = 'CON' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

    // Check if a connection already exists in either direction
    const [existing] = await pool.execute(
      `SELECT * FROM connections
       WHERE (requester_id = ? AND receiver_id = ?)
          OR (requester_id = ? AND receiver_id = ?)`,
      [requester_id, receiver_id, receiver_id, requester_id]
    );

    if (existing.length > 0) {
      const conn = existing[0];
      if (conn.status === 'accepted') {
        return res.status(409).json({
          success: false,
          message: 'You are already connected with this user'
        });
      }
      if (conn.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'A connection request already exists between these users',
          connection_id: conn.connection_id,
          status: conn.status
        });
      }
      // If previously rejected, allow a new request by updating the existing row
      if (conn.status === 'rejected') {
        await pool.execute(
          `UPDATE connections SET status = 'pending', requester_id = ?, receiver_id = ?,
           connection_id = ?, updated_at = NOW() WHERE id = ?`,
          [requester_id, receiver_id, connection_id, conn.id]
        );

        await publishEvent('connection.requested', requester_id, 'connection', connection_id, {
          connection_id,
          requester_id,
          receiver_id,
          status: 'pending'
        });

        return res.status(200).json({
          success: true,
          message: 'Connection request re-sent successfully',
          data: { connection_id, requester_id, receiver_id, status: 'pending' }
        });
      }
    }

    // Insert new connection request
    await pool.execute(
      `INSERT INTO connections (connection_id, requester_id, receiver_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [connection_id, requester_id, receiver_id]
    );

    // Publish Kafka event: connection.requested
    await publishEvent('connection.requested', requester_id, 'connection', connection_id, {
      connection_id,
      requester_id,
      receiver_id,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully',
      data: { connection_id, requester_id, receiver_id, status: 'pending' }
    });
  } catch (error) {
    // Handle duplicate entry (MySQL unique constraint violation)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate connection request'
      });
    }
    console.error('Error sending connection request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/connections/accept — Accept a pending connection request
router.post('/accept', async (req, res) => {
  try {
    const { connection_id } = req.body;

    if (!connection_id) {
      return res.status(400).json({ success: false, message: 'connection_id is required' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM connections WHERE connection_id = ?',
      [connection_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    const conn = rows[0];

    if (conn.status === 'accepted') {
      return res.status(409).json({ success: false, message: 'Connection already accepted' });
    }

    if (conn.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a connection with status: ${conn.status}`
      });
    }

    await pool.execute(
      "UPDATE connections SET status = 'accepted', updated_at = NOW() WHERE connection_id = ?",
      [connection_id]
    );

    await Promise.all([
      incrementConnectionsCount(conn.requester_id),
      incrementConnectionsCount(conn.receiver_id),
    ]);

    // Publish Kafka event: connection.accepted
    try {
      await publishEvent('connection.accepted', conn.receiver_id, 'connection', connection_id, {
        connection_id,
        requester_id: conn.requester_id,
        receiver_id: conn.receiver_id,
        status: 'accepted'
      });
    } catch (kafkaErr) {
      console.error('connection.accepted Kafka publish failed:', kafkaErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Connection accepted successfully',
      data: {
        connection_id,
        requester_id: conn.requester_id,
        receiver_id: conn.receiver_id,
        status: 'accepted'
      }
    });
  } catch (error) {
    console.error('Error accepting connection:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/connections/reject — Reject a pending connection request
router.post('/reject', async (req, res) => {
  try {
    const { connection_id } = req.body;

    if (!connection_id) {
      return res.status(400).json({ success: false, message: 'connection_id is required' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM connections WHERE connection_id = ?',
      [connection_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    if (rows[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a connection with status: ${rows[0].status}`
      });
    }

    await pool.execute(
      "UPDATE connections SET status = 'rejected', updated_at = NOW() WHERE connection_id = ?",
      [connection_id]
    );

    res.status(200).json({
      success: true,
      message: 'Connection request rejected',
      data: {
        connection_id,
        requester_id: rows[0].requester_id,
        receiver_id: rows[0].receiver_id,
        status: 'rejected'
      }
    });
  } catch (error) {
    console.error('Error rejecting connection:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/connections/list — List all connections for a user
router.post('/list', async (req, res) => {
  try {
    const { user_id, status } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    const pool = getPool();
    let query = `SELECT * FROM connections WHERE (requester_id = ? OR receiver_id = ?)`;
    let params = [user_id, user_id];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY updated_at DESC`;

    const [rows] = await pool.execute(query, params);

    // Separate into sent, received, and accepted
    const connections = rows.map(row => ({
      connection_id: row.connection_id,
      requester_id: row.requester_id,
      receiver_id: row.receiver_id,
      status: row.status,
      direction: row.requester_id === user_id ? 'sent' : 'received',
      connected_user_id: row.requester_id === user_id ? row.receiver_id : row.requester_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.status(200).json({
      success: true,
      user_id,
      total_connections: connections.length,
      connections
    });
  } catch (error) {
    console.error('Error listing connections:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/connections/mutual — Get mutual connections between two users (extra credit)
router.post('/mutual', async (req, res) => {
  try {
    const { user_id_1, user_id_2 } = req.body;

    if (!user_id_1 || !user_id_2) {
      return res.status(400).json({
        success: false,
        message: 'user_id_1 and user_id_2 are required'
      });
    }

    const pool = getPool();

    // Find all accepted connections for user 1
    const [user1Connections] = await pool.execute(
      `SELECT CASE
         WHEN requester_id = ? THEN receiver_id
         ELSE requester_id
       END AS connected_user
       FROM connections
       WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'`,
      [user_id_1, user_id_1, user_id_1]
    );

    // Find all accepted connections for user 2
    const [user2Connections] = await pool.execute(
      `SELECT CASE
         WHEN requester_id = ? THEN receiver_id
         ELSE requester_id
       END AS connected_user
       FROM connections
       WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'`,
      [user_id_2, user_id_2, user_id_2]
    );

    const user1Set = new Set(user1Connections.map(r => r.connected_user));
    const user2Set = new Set(user2Connections.map(r => r.connected_user));

    // Mutual = intersection of both sets
    const mutual = [...user1Set].filter(id => user2Set.has(id));

    res.status(200).json({
      success: true,
      user_id_1,
      user_id_2,
      mutual_count: mutual.length,
      mutual_connections: mutual
    });
  } catch (error) {
    console.error('Error finding mutual connections:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
