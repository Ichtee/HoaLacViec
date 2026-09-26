import express from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Review } from '../models/Review.js';
import { MicroTask } from '../models/MicroTask.js';
import { Notification } from '../models/Notification.js';
import { authenticate, authorize, requireActiveUser } from '../middlewares/auth.js';
import { TASK_STATUSES } from '../utils/taskContract.js';

const router = express.Router();

function logNotificationError(context, err) {
  console.error('[NotificationError]', {
    context,
    message: err?.message,
    timestamp: new Date().toISOString(),
  });
}

// ─── POST /api/reports (Gửi khiếu nại / Báo cáo vi phạm) ─────────────
router.post('/', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    const { targetType, targetId, reason, content, evidenceUrl } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do báo cáo.', code: 'MISSING_REASON' });
    }

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung báo cáo chi tiết.', code: 'MISSING_CONTENT' });
    }

    const cleanReason = String(reason).trim();
    const cleanContent = String(content).trim();
    const cleanEvidence = evidenceUrl ? String(evidenceUrl).trim() : '';

    const validTypes = ['job', 'employer', 'student', 'task', 'review', 'user', 'other'];
    const resolvedType = validTypes.includes(targetType) ? targetType : 'other';

    let resolvedTargetId = null;
    let resolvedTargetName = 'Đối tượng báo cáo';
    let resolvedReportedUserId = null;

    if (targetId) {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ error: 'Mã đối tượng báo cáo không hợp lệ.', code: 'INVALID_TARGET_ID' });
      }
      resolvedTargetId = targetId;

      // Authoritative target verification from database
      if (resolvedType === 'task') {
        const task = await MicroTask.findById(targetId);
        if (!task) {
          return res.status(404).json({ error: 'Không tìm thấy việc vặt được báo cáo.', code: 'TARGET_NOT_FOUND' });
        }
        resolvedTargetName = `Việc vặt: ${task.title}`;
        // Resolve reported user: if reporter is requester, target is assignee, and vice-versa
        const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
        resolvedReportedUserId = isRequester ? task.assigneeId : task.requesterId;
      } else if (resolvedType === 'job') {
        const job = await Job.findById(targetId);
        if (!job) {
          return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng được báo cáo.', code: 'TARGET_NOT_FOUND' });
        }
        resolvedTargetName = `Tin việc làm: ${job.title}`;
        resolvedReportedUserId = job.employerId || null;
      } else if (resolvedType === 'review') {
        const review = await Review.findById(targetId);
        if (!review) {
          return res.status(404).json({ error: 'Không tìm thấy đánh giá được báo cáo.', code: 'TARGET_NOT_FOUND' });
        }
        resolvedTargetName = `Đánh giá từ ${review.reviewerName}`;
        resolvedReportedUserId = review.reviewerId || null;
      } else if (['user', 'employer', 'student'].includes(resolvedType)) {
        const u = await User.findById(targetId);
        if (!u) {
          return res.status(404).json({ error: 'Không tìm thấy người dùng được báo cáo.', code: 'TARGET_NOT_FOUND' });
        }
        resolvedTargetName = `Tài khoản: ${u.name || u.email}`;
        resolvedReportedUserId = u._id;
      }
    }

    const report = await Report.create({
      reporterId: req.user._id,
      reporterName: req.user.name || 'Người dùng',
      reporterEmail: req.user.email || '',
      targetType: resolvedType,
      targetId: resolvedTargetId,
      target: resolvedTargetName,
      reportedUserId: resolvedReportedUserId,
      openedBy: req.user._id,
      reason: cleanReason,
      content: cleanContent,
      evidenceUrl: cleanEvidence,
      status: 'pending',
      history: [
        {
          action: 'created',
          performedBy: req.user._id,
          note: `Khởi tạo báo cáo: ${cleanReason}`,
          timestamp: new Date(),
        },
      ],
    });

    res.status(201).json({
      message: 'Đã gửi báo cáo thành công. Ban quản trị Hòa Lạc Việc sẽ xác minh và phản hồi sớm nhất.',
      report,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports (Admin xem danh sách báo cáo) ─────────────────
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status, targetType, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (targetType && targetType !== 'all') {
      filter.targetType = targetType;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, reports] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter)
        .populate('reportedUserId', 'name email phone role status')
        .populate('reporterId', 'name email phone role')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const formatted = reports.map((r) => ({
      ...r,
      id: r._id,
      createdAtFormatted: r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reports/:id/resolve (Admin xử lý báo cáo) ────────────
router.post('/:id/resolve', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã báo cáo không hợp lệ.', code: 'INVALID_ID' });
    }

    const {
      status = 'resolved',
      action = 'no_action',
      resolutionNote,
      taskResolution, // 'completed' | 'cancelled' (khi targetType === 'task')
    } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo khiếu nại.', code: 'NOT_FOUND' });
    }

    // Terminal state protection
    if (['resolved', 'dismissed'].includes(report.status)) {
      return res.status(409).json({
        error: `Báo cáo này đã ở trạng thái kết thúc (${report.status}) và không thể xử lý lại.`,
        code: 'REPORT_ALREADY_TERMINAL',
      });
    }

    // Required resolution note
    const cleanNote = String(resolutionNote || '').trim();
    if (!cleanNote) {
      return res.status(400).json({
        error: 'Vui lòng nhập ghi chú kết luận xử lý bắt buộc cho biên bản giải quyết.',
        code: 'MISSING_RESOLUTION_NOTE',
      });
    }

    const validActions = [
      'no_action',
      'warned',
      'content_removed',
      'account_suspended',
      'account_locked',
      'refund_required',
    ];
    const cleanAction = validActions.includes(action) ? action : 'no_action';

    const validNextStatuses = ['investigating', 'resolved', 'dismissed'];
    const nextStatus = validNextStatuses.includes(status) ? status : 'resolved';

    const now = new Date();

    // 1. Authoritative User Penalty Handling: ONLY act on reportedUserId
    if (['account_suspended', 'account_locked'].includes(cleanAction)) {
      if (report.reportedUserId) {
        await User.findByIdAndUpdate(report.reportedUserId, {
          status: cleanAction === 'account_locked' ? 'locked' : 'suspended',
        });
      }
    }

    // 2. Content Handling: remove or archive target content
    if (cleanAction === 'content_removed' && report.targetId) {
      if (report.targetType === 'task') {
        await MicroTask.findByIdAndUpdate(report.targetId, {
          status: TASK_STATUSES.CANCELLED,
          isDeleted: true,
          $push: {
            history: {
              status: TASK_STATUSES.CANCELLED,
              changedBy: req.user._id,
              note: `Admin gỡ bỏ nội dung do vi phạm: ${cleanNote}`,
              timestamp: now,
            },
          },
        });
      } else if (report.targetType === 'review') {
        await Review.findByIdAndUpdate(report.targetId, { status: 'hidden' });
      } else if (report.targetType === 'job') {
        await Job.findByIdAndUpdate(report.targetId, { status: 'closed' });
      }
    }

    // 3. Task specific resolution: admin reconciles disputed task
    if (report.targetType === 'task' && report.targetId && taskResolution) {
      if (['completed', 'cancelled'].includes(taskResolution)) {
        await MicroTask.findByIdAndUpdate(report.targetId, {
          status: taskResolution === 'completed' ? TASK_STATUSES.COMPLETED : TASK_STATUSES.CANCELLED,
          $push: {
            history: {
              status: taskResolution === 'completed' ? TASK_STATUSES.COMPLETED : TASK_STATUSES.CANCELLED,
              changedBy: req.user._id,
              note: `Admin giải quyết khiếu nại: Chuyển task sang ${taskResolution}. Ghi chú: ${cleanNote}`,
              timestamp: now,
            },
          },
        });
      }
    }

    // Update Report
    report.status = nextStatus;
    report.actionTaken = cleanAction;
    report.taskResolution = taskResolution || '';
    report.resolutionNote = cleanNote;
    report.resolvedBy = req.user._id;
    report.resolvedAt = now;
    report.history.push({
      action: `resolved_${cleanAction}`,
      performedBy: req.user._id,
      note: cleanNote,
      timestamp: now,
    });

    await report.save();

    // 4. Send Notification to Reporter
    try {
      await Notification.create({
        userId: report.reporterId,
        title: 'Báo cáo / khiếu nại của bạn đã được xử lý ✅',
        message: `Báo cáo về "${report.target}" đã được xử lý. Kết luận: ${cleanNote}`,
        type: 'report',
        link: report.targetType === 'task' ? '/tasks?tab=disputed' : '/student/applications',
      });
    } catch (notifErr) {
      logNotificationError('report_reporter_notification', notifErr);
    }

    // 5. Send Notification to Reported User (if penalized or warned)
    if (report.reportedUserId && ['warned', 'account_suspended', 'account_locked'].includes(cleanAction)) {
      try {
        await Notification.create({
          userId: report.reportedUserId,
          title: 'Thông báo xử lý vi phạm từ Ban quản trị ⚠️',
          message: `Tài khoản của bạn nhận quyết định "${cleanAction}" liên quan đến khiếu nại về "${report.target}". Lý do: ${cleanNote}`,
          type: 'report',
          link: '/notifications',
        });
      } catch (notifErr) {
        logNotificationError('report_accused_notification', notifErr);
      }
    }

    res.json({
      message: 'Đã giải quyết báo cáo thành công.',
      report,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
