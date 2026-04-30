const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  message_id: { type: String, required: true, unique: true },
  thread_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true },
  sender_name: { type: String, default: '' },
  message_text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
  idempotency_key: { type: String, unique: true, sparse: true }
});

messageSchema.index({ thread_id: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
