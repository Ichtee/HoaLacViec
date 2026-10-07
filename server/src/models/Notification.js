import mongoose from 'mongoose';
import { sendPushToUser, isPushConfigured } from '../services/pushService.js';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['application', 'job', 'verification', 'shift', 'system', 'task', 'report', 'employment', 'time_off'],
    default: 'system',
  },
  link: {
    type: String,
    default: '',
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

// Mọi thông báo mới tự động được đẩy tới thiết bị đã đăng ký (nếu Web Push được cấu hình)
notificationSchema.pre('save', function (next) {
  this.$locals.wasNew = this.isNew;
  next();
});
export function pushNewNotification(doc) {
  if (!doc.$locals?.wasNew || !isPushConfigured()) return;
  void sendPushToUser(doc.userId, { title: doc.title, body: doc.message, url: doc.link || '/' });
}
notificationSchema.post('save', pushNewNotification);

export const Notification = mongoose.model('Notification', notificationSchema);

