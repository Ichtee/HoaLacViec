import express from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';
import { countUnreadMessages } from './chatRoutes.js';

const router = express.Router();

// Require authentication for all notification routes
router.use(authenticate);

// GET /api/notifications (Lấy danh sách thông báo của người dùng hiện tại)
router.get('/', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(Math.min(50, parseInt(limit) || 30))
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/summary: số chưa đọc của chuông thông báo và tin nhắn trong MỘT request (thay cho 2 lượt gọi riêng)
router.get('/summary', async (req, res) => {
  try {
    const [unreadCount, messages] = await Promise.all([
      Notification.countDocuments({ userId: req.user._id, read: false }),
      countUnreadMessages(req.user._id),
    ]);
    res.json({ unreadCount, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count (Đếm số thông báo chưa đọc cho badge quả chuông)
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read (Đánh dấu 1 thông báo là đã đọc)
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all (Đánh dấu toàn bộ thông báo là đã đọc)
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id (Xóa thông báo)
router.delete('/:id', async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Đã xóa thông báo' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

