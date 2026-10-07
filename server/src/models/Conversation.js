import mongoose from 'mongoose';

/**
 * Cuộc trò chuyện 1-1 gắn với một đơn ứng tuyển hoặc một việc vặt.
 * Mỗi (kind, refId) chỉ có một cuộc trò chuyện.
 */
const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  lastReadAt: { type: Date, default: () => new Date(0) },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  kind: { type: String, enum: ['application', 'task'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, default: '' },
  participants: {
    type: [participantSchema],
    validate: [(value) => value.length === 2, 'Cuộc trò chuyện phải có đúng 2 người tham gia.'],
  },
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '' },
  lastSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

conversationSchema.index({ kind: 1, refId: 1 }, { unique: true });
conversationSchema.index({ 'participants.userId': 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
