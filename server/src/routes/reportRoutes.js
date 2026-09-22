import express from 'express';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// POST /api/reports (Gửi báo cáo vi phạm / khiếu nại - Authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    const { targetType, targetId, target, reason, content, evidenceUrl } = req.body;

    if (!reason || !content) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do và nội dung báo cáo chi tiết.' });
    }

    const report = await Report.create({
      reporterId: req.user._id,
      reporterName: req.user.name || 'Người dùng',
      reporterEmail: req.user.email || '',
      targetType: targetType || 'other',
      targetId: targetId || null,
      target: target || 'Đối tượng được báo cáo',
      reason: reason.trim(),
      content: content.trim(),
      evidenceUrl: evidenceUrl || '',
      status: 'pending',
    });

    res.status(201).json({
      message: 'Đã gửi báo cáo thành công. Ban quản trị Hòa Lạc Việc sẽ kiểm tra và xử lý.',
      report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports (Admin xem danh sách báo cáo)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, targetType } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (targetType && targetType !== 'all') filter.targetType = targetType;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const formatted = reports.map((r) => ({
      ...r,
      id: r._id,
      createdAtFormatted: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/resolve (Admin xử lý báo cáo)
router.post('/:id/resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, resolutionNote } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    report.status = 'resolved';
    report.actionTaken = action || 'warned';
    report.resolutionNote = resolutionNote || 'Đã kiểm tra và xử lý theo quy định cộng đồng.';
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();

    // If action is to suspend/lock the target user
    if (action === 'refunded_or_banned' || action === 'locked') {
      if (report.targetId) {
        await User.findByIdAndUpdate(report.targetId, { status: 'locked' });
      }
    }

    await report.save();

    // Notify the reporter
    try {
      await Notification.create({
        userId: report.reporterId,
        title: 'Báo cáo của bạn đã được xử lý ✅',
        message: `Báo cáo về "${report.target}" đã được xử lý. Kết quả: ${report.resolutionNote}`,
        type: 'system',
        link: '/student/applications',
      });
    } catch (notifErr) {
      console.warn('Report resolve notification error:', notifErr.message);
    }

    res.json({ message: 'Đã giải quyết báo cáo thành công', report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

