const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Thread = require('../models/Thread');

// POST /api/messaging/threads/open — Create or open a thread between participants
router.post('/open', async (req, res) => {
  try {
    const { participant_ids } = req.body;

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'participant_ids must be an array with at least 2 user IDs'
      });
    }

    // Check if a thread already exists between these participants
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

    // Build participant objects (names/roles can be enriched later via Profile Service)
    const participants = participant_ids.map(id => ({
      user_id: id,
      name: '',
      role: id.startsWith('R') ? 'recruiter' : 'member'
    }));

    const thread = new Thread({
      thread_id: 'T' + uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase(),
      participants,
      created_at: new Date(),
      last_message_at: new Date(),
      message_count: 0
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

// POST /api/messaging/threads/get — Get thread metadata
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

// POST /api/messaging/threads/byUser — List all threads for a user
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
        message_count: t.message_count
      }))
    });
  } catch (error) {
    console.error('Error listing threads:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
