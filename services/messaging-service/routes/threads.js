const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Thread = require('../models/Thread');

// Helper: is this thread unread for the given user?
function isUnread(thread, userId) {
  const lastRead = thread.last_read && thread.last_read[userId];
  const baseline = lastRead ? new Date(lastRead) : new Date(thread.created_at);
  return thread.last_message_at > baseline;
}

// POST /api/messaging/threads/open
router.post('/open', async (req, res) => {
  try {
    const { participant_ids } = req.body;

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'participant_ids must be an array with at least 2 user IDs'
      });
    }

    const existingThread = await Thread.findOne({
      'participants.user_id': { $all: participant_ids },
      participants: { $size: participant_ids.length }
    });

    if (existingThread) {
      return res.status(200).json({
        thread_id: existingThread.thread_id,
        participants: existingThread.participants,
        created_at: existingThread.created_at.toISOString(),
        message: 'Thread already exists'
      });
    }

    const participants = participant_ids.map(id => ({
      user_id: id,
      name: '',
      role: id.startsWith('R') ? 'recruiter' : 'member'
    }));

    // Mark all participants as having read at creation time
    const now = new Date();
    const last_read = {};
    participant_ids.forEach(id => { last_read[id] = now; });

    const thread = new Thread({
      thread_id: 'T' + uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase(),
      participants,
      created_at: now,
      last_message_at: now,
      message_count: 0,
      last_read,
    });

    await thread.save();

    res.status(200).json({
      thread_id: thread.thread_id,
      participants: thread.participants,
      created_at: thread.created_at.toISOString(),
      message: 'Thread created successfully'
    });
  } catch (error) {
    console.error('Error opening thread:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/messaging/threads/get
router.post('/get', async (req, res) => {
  try {
    const { thread_id } = req.body;
    if (!thread_id) {
      return res.status(400).json({ success: false, message: 'thread_id is required' });
    }
    const thread = await Thread.findOne({ thread_id });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    res.status(200).json({
      thread_id: thread.thread_id,
      participants: thread.participants,
      created_at: thread.created_at.toISOString(),
      last_message_at: thread.last_message_at.toISOString(),
      message_count: thread.message_count
    });
  } catch (error) {
    console.error('Error getting thread:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/messaging/threads/byUser — includes unread flag per thread
router.post('/byUser', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    const threads = await Thread.find({
      'participants.user_id': user_id
    }).sort({ last_message_at: -1 });

    res.status(200).json({
      user_id,
      total_threads: threads.length,
      threads: threads.map(t => ({
        thread_id: t.thread_id,
        participants: t.participants,
        created_at: t.created_at.toISOString(),
        last_message_at: t.last_message_at.toISOString(),
        message_count: t.message_count,
        unread: isUnread(t, user_id),
      }))
    });
  } catch (error) {
    console.error('Error listing threads:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/messaging/threads/mark-read
router.post('/mark-read', async (req, res) => {
  try {
    const { thread_id, user_id } = req.body;
    if (!thread_id || !user_id) {
      return res.status(400).json({ success: false, message: 'thread_id and user_id are required' });
    }
    await Thread.updateOne(
      { thread_id },
      { $set: { [`last_read.${user_id}`]: new Date() } }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking thread read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/messaging/threads/unread-count
router.post('/unread-count', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }
    const threads = await Thread.find({ 'participants.user_id': user_id });
    const count = threads.filter(t => isUnread(t, user_id)).length;
    res.status(200).json({ user_id, unread_count: count });
  } catch (error) {
    console.error('Error counting unread threads:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
