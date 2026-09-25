import express from 'express';
import mongoose from 'mongoose';
import { MicroTask } from '../models/MicroTask.js';
import { Notification } from '../models/Notification.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.js';

const router = express.Router();

function maskPhone(phone) {
  if (!phone) return '';
  const clean = phone.toString().trim();
  if (clean.length <= 6) return '***';
  return clean.slice(0, 3) + '****' + clean.slice(-3);
}

// GET /api/tasks
router.get('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const { category, status, requesterId, assigneeId } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (status) filter.status = status;
    if (requesterId) filter.requesterId = requesterId;
    if (assigneeId) filter.assigneeId = assigneeId;

    const tasks = await MicroTask.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const currentUserId = req.user?._id?.toString() || null;

    const formatted = tasks.map((t) => {
      const isParticipant =
        currentUserId &&
        ((t.requesterId && t.requesterId.toString() === currentUserId) ||
          (t.assigneeId && t.assigneeId.toString() === currentUserId));

      return {
        ...t,
        id: t._id,
        requesterPhone: isParticipant && t.status !== 'open' ? t.requesterPhone : maskPhone(t.requesterPhone),
        assigneePhone: isParticipant ? t.assigneePhone : maskPhone(t.assigneePhone),
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const task = await MicroTask.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });

    const currentUserId = req.user?._id?.toString() || null;

    const isParticipant =
      currentUserId &&
      ((task.requesterId && task.requesterId.toString() === currentUserId) ||
        (task.assigneeId && task.assigneeId.toString() === currentUserId));

    res.json({
      ...task,
      id: task._id,
      requesterPhone: isParticipant && task.status !== 'open' ? task.requesterPhone : maskPhone(task.requesterPhone),
      assigneePhone: isParticipant ? task.assigneePhone : maskPhone(task.assigneePhone),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks (Đăng việc vặt mới - Authenticated)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      title,
      category,
      description,
      reward,
      location,
      deadline,
      deadlineDate,
      requesterName,
      requesterPhone,
    } = req.body;

    if (!title || !description || !reward) {
      return res.status(400).json({
        error: 'Vui lòng điền đủ tiêu đề, mô tả và tiền thù lao.',
        code: 'MISSING_FIELDS',
      });
    }

    const numReward = Number(reward);
    if (isNaN(numReward) || numReward < 5000) {
      return res.status(400).json({
        error: 'Thù lao tối thiểu cho một việc vặt là 5.000 VNĐ.',
        code: 'INVALID_REWARD',
      });
    }

    const phoneToUse = requesterPhone || req.user.phone || '';
    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp số điện thoại liên hệ.',
        code: 'MISSING_PHONE',
      });
    }

    // Parse structured Date deadline
    let parsedDeadlineDate = null;
    if (deadlineDate) {
      const d = new Date(deadlineDate);
      if (!isNaN(d.getTime())) parsedDeadlineDate = d;
    } else if (deadline) {
      const d = new Date(deadline);
      if (!isNaN(d.getTime())) parsedDeadlineDate = d;
    }

    const task = await MicroTask.create({
      title: title.trim(),
      category: category || 'di_cho',
      description: description.trim(),
      reward: numReward,
      location: (location || 'Hòa Lạc').trim(),
      deadline: (deadline || 'Hôm nay').trim(),
      deadlineDate: parsedDeadlineDate,
      requesterId: req.user._id,
      requesterName: requesterName || req.user.name || 'Thành viên',
      requesterPhone: phoneToUse.trim(),
      status: 'open',
    });

    res.status(201).json({ ...task.toObject(), id: task._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/accept (Nhận việc vặt - Atomic Race-Condition Safe)
router.post('/:id/accept', authenticate, async (req, res, next) => {
  try {
    const { note, assigneePhone } = req.body;

    const existing = await MicroTask.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng việc vặt.', code: 'NOT_FOUND' });
    }

    if (existing.requesterId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự nhận công việc do chính mình đăng.', code: 'SELF_ACCEPT_FORBIDDEN' });
    }

    const userPhone = assigneePhone || req.user.phone || '';

    const updated = await MicroTask.findOneAndUpdate(
      { _id: req.params.id, status: 'open' },
      {
        $set: {
          status: 'accepted',
          assigneeId: req.user._id,
          assigneeName: req.user.name || 'Sinh viên',
          assigneePhone: userPhone,
          note: note || '',
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Rất tiếc! Công việc này vừa có bạn khác nhận hoặc không còn mở.',
        code: 'TASK_ALREADY_TAKEN',
      });
    }

    // Notify requester
    try {
      await Notification.create({
        userId: updated.requesterId,
        title: 'Có bạn nhận việc vặt của bạn! 🎉',
        message: `${req.user.name || 'Một bạn sinh viên'} đã nhận việc "${updated.title}". Số điện thoại liên hệ: ${userPhone || 'Xem trong đơn'}.`,
        type: 'task',
        link: '/tasks',
      });
    } catch (notifErr) {
      console.warn('Task accept notification error:', notifErr.message);
    }

    res.json({
      message: 'Đã nhận việc thành công! Số điện thoại liên hệ đã được mở khóa.',
      task: { ...updated.toObject(), id: updated._id },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/submit-completion (Step 1 of 2: Assignee marks finished and submits proof)
router.post('/:id/submit-completion', authenticate, async (req, res, next) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });

    const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();
    if (!isAssignee && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ người nhận việc mới có quyền báo cáo hoàn thành công việc.', code: 'FORBIDDEN' });
    }

    if (task.status !== 'accepted') {
      return res.status(400).json({ error: `Công việc đang ở trạng thái "${task.status}", không thể gửi báo cáo hoàn thành.`, code: 'INVALID_STATUS' });
    }

    const { proof } = req.body;
    task.status = 'submitted_for_completion';
    if (proof) task.completionProof = String(proof).trim();
    await task.save();

    // Notify requester
    try {
      await Notification.create({
        userId: task.requesterId,
        title: 'Người nhận việc đã hoàn tất! 📦',
        message: `${task.assigneeName || 'Người nhận việc'} đã báo cáo hoàn thành "${task.title}". Vui lòng kiểm tra và xác nhận hoàn tất.`,
        type: 'task',
        link: '/tasks',
      });
    } catch (notifErr) {
      console.warn('Task completion submit notification error:', notifErr.message);
    }

    res.json({
      message: 'Đã gửi báo cáo hoàn tất việc vặt đến người đăng!',
      task: { ...task.toObject(), id: task._id },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/complete (Step 2 of 2: Requester confirms task completion)
router.post('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    if (!isRequester && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ người đăng việc mới có quyền chốt hoàn thành công việc.', code: 'FORBIDDEN' });
    }

    if (!['submitted_for_completion', 'accepted'].includes(task.status)) {
      return res.status(400).json({ error: `Không thể chốt hoàn thành công việc ở trạng thái "${task.status}".`, code: 'INVALID_STATUS' });
    }

    task.status = 'completed';
    await task.save();

    // Notify assignee
    try {
      if (task.assigneeId) {
        await Notification.create({
          userId: task.assigneeId,
          title: 'Việc vặt đã được xác nhận hoàn thành! ✅',
          message: `Người đăng đã xác nhận hoàn tất công việc "${task.title}". Cảm ơn bạn đã hỗ trợ!`,
          type: 'task',
          link: '/tasks',
        });
      }
    } catch (notifErr) {
      console.warn('Task complete notification error:', notifErr.message);
    }

    res.json({ message: 'Đã xác nhận hoàn thành việc vặt!', task: { ...task.toObject(), id: task._id } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/dispute (Báo cáo tranh chấp việc vặt)
router.post('/:id/dispute', authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();

    if (!isRequester && !isAssignee && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền báo cáo tranh chấp cho công việc này.', code: 'FORBIDDEN' });
    }

    task.status = 'disputed';
    task.disputeReason = (reason || 'Có tranh chấp về kết quả công việc').trim();
    await task.save();

    res.json({ message: 'Đã chuyển việc vặt sang trạng thái tranh chấp cần đối soát.', task: { ...task.toObject(), id: task._id } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id (Hủy bài đăng việc vặt)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });

    if (req.user.role !== 'admin' && task.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này.', code: 'FORBIDDEN' });
    }

    if (task.status === 'accepted' || task.status === 'submitted_for_completion') {
      return res.status(400).json({ error: 'Công việc đang có người thực hiện, không thể xóa ngay.', code: 'TASK_IN_PROGRESS' });
    }

    await MicroTask.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa bài đăng việc vặt' });
  } catch (err) {
    next(err);
  }
});

export default router;
