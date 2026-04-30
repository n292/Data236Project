const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  name: { type: String, default: '' },
  role: { type: String, enum: ['member', 'recruiter'], default: 'member' }
}, { _id: false });

const threadSchema = new mongoose.Schema({
  thread_id: { type: String, required: true, unique: true },
  participants: [participantSchema],
  created_at: { type: Date, default: Date.now },
  last_message_at: { type: Date, default: Date.now },
  message_count: { type: Number, default: 0 }
});

threadSchema.index({ 'participants.user_id': 1 });
threadSchema.index({ last_message_at: -1 });

module.exports = mongoose.model('Thread', threadSchema);
