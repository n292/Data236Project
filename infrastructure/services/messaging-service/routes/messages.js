const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const Thread = require('../models/Thread');
const { publishEvent } = require('../config/kafka');

// POST /api/messaging/messages/send — Send a message in a thread
// Includes: idempotency check, retry-safe design, Kafka event publishing
router.post('/send', async (req, res) => {
  try {
    const { thread_id, sender_id, sender_name, message_text, idempotency_key } = req.body;

    // Validate required fields
    if (!thread_id || !sender_id || !message_text) {
      return res.status(400).json({
        success: false,
        message: 'thread_id, sender_id, and message_text are required'
      });
    }

    // Idempotency check: if client retries with same key, return existing message
    if (idempotency_key) {
      const existing = await Message.findOne({ idempotency_key });
      if (existing) {
        return res.status(200).json({
          message_id: existing.message_id,
          thread_id: existing.thread_id,
          sender_id: existing.sender_id,
          sender_name: existing.sender_name,
          message_text: existing.message_text,
          timestamp: existing.timestamp.toISOString(),
          status: existing.status,
          message: 'Message already sent (idempotent)'
        });
      }
    }

    // Verify thread exists
    const thread = await Thread.findOne({ thread_id });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    // Verify sender is a participant
    const isParticipant = thread.participants.some(p => p.user_id === sender_id);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Sender is not a participant in this thread'
      });
    }

    // Create and save the message
    const message = new Message({
      message_id: 'MSG' + uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase(),
      thread_id,
      sender_id,
      sender_name: sender_name || '',
      message_text,
      timestamp: new Date(),
      status: 'sent',
      idempotency_key: idempotency_key || uuidv4()
    });

    await message.save();

    // Update thread's last_message_at and message_count
    await Thread.updateOne(
      { thread_id },
      {
        $set: { last_message_at: message.timestamp },
        $inc: { message_count: 1 }
      }
    );

    // Publish Kafka event: message.sent
    await publishEvent(
      'message.sent',
      sender_id,
      'thread',
      thread_id,
      {
        message_id: message.message_id,
        thread_id: message.thread_id,
        sender_id: message.sender_id,
        sender_name: message.sender_name,
        message_text: message.message_text,
        timestamp: message.timestamp.toISOString()
      }
    );

    res.status(200).json({
      message_id: message.message_id,
      thread_id: message.thread_id,
      sender_id: message.sender_id,
      sender_name: message.sender_name,
      message_text: message.message_text,
      timestamp: message.timestamp.toISOString(),
      status: message.status,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);

    // If it's a duplicate key error on idempotency_key, the message was already saved
    if (error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await Message.findOne({ idempotency_key: req.body.idempotency_key });
      if (existing) {
        return res.status(200).json({
          message_id: existing.message_id,
          thread_id: existing.thread_id,
          sender_id: existing.sender_id,
          message_text: existing.message_text,
          timestamp: existing.timestamp.toISOString(),
          status: existing.status,
          message: 'Message already sent (idempotent)'
        });
      }
    }

    res.status(500).json({ success: false, message: 'Failed to send message. Please retry.' });
  }
});

// POST /api/messaging/messages/list — List all messages in a thread
router.post('/list', async (req, res) => {
  try {
    const { thread_id } = req.body;

    if (!thread_id) {
      return res.status(400).json({ success: false, message: 'thread_id is required' });
    }

    const thread = await Thread.findOne({ thread_id });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    const messages = await Message.find({ thread_id }).sort({ timestamp: 1 });

    if (messages.length === 0) {
      return res.status(200).json({
        thread_id,
        total_messages: 0,
        messages: [],
        message: 'No messages in thread'
      });
    }

    res.status(200).json({
      thread_id,
      total_messages: messages.length,
      messages: messages.map(m => ({
        message_id: m.message_id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        message_text: m.message_text,
        timestamp: m.timestamp.toISOString(),
        status: m.status
      }))
    });
  } catch (error) {
    console.error('Error listing messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
