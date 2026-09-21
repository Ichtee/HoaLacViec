import express from 'express';
import { MicroTask } from '../models/MicroTask.js';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Helper to mask phone for public privacy
function maskPhone(phone) {
  if (!phone) return '';
  const clean = phone.toString().trim();
  if (clean.length <= 6) return '***';
  return clean.slice(0, 3) + '****' + clean.slice(-3);
}

// GET /api/tasks (Lấy danh sách việc vặt với bảo mật thông tin liên hệ)
router.get('/', async (req, res) => {
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

    // Check if token exists to determine if caller is requester or assignee
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'hoalacviec_dev_secret_key_2026');
        currentUserId = decoded.id;
      } catch {
        // Unauthenticated visitor
      }
    }

    const formatted = tasks.map((t) => {
      const isParticipant =
        currentUserId &&
        ((t.requesterId && t.requesterId.toString() === currentUserId) ||
          (t.assigneeId && t.assigneeId.toString() === currentUserId));

      return {
        ...t,
        id: t._id,
        // Privacy: only reveal unmasked phone to participants of accepted/completed tasks
        requesterPhone: isParticipant && t.status !== 'open' ? t.requesterPhone : maskPhone(t.requesterPhone),
        assigneePhone: isParticipant ? t.assigneePhone : maskPhone(t.assigneePhone),
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.' });

    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'hoalacviec_dev_secret_key_2026');
        currentUserId = decoded.id;
      } catch {
        // Unauthenticated
      }
    }

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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks (Đăng việc vặt mới - Authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      reward,
      location,
      deadline,
      requesterName,
      requesterPhone,
    } = req.body;

    if (!title || !description || !reward) {
      return res.status(400).json({ error: 'Vui lòng điền đủ tiêu đề, mô tả và tiền thù lao.' });
    }

    const numReward = Number(reward);
    if (isNaN(numReward) || numReward < 5000) {
      return res.status(400).json({ error: 'Thù lao tối thiểu cho một việc vặt là 5.000 VNĐ.' });
    }

    const phoneToUse = requesterPhone || req.user.phone || '';
    if (!phoneToUse) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại hoặc cập nhật hồ sơ để người nhận tiện liên hệ.' });
    }

    const task = await MicroTask.create({
      title: title.trim(),
      category: category || 'di_cho',
      description: description.trim(),
      reward: numReward,
      location: (location || 'Hòa Lạc').trim(),
      deadline: (deadline || 'Hôm nay').trim(),
      requesterId: req.user._id,
      requesterName: requesterName || req.user.name || 'Sinh viên',
      requesterPhone: phoneToUse.trim(),
      status: 'open',
    });

    res.status(201).json({ ...task.toObject(), id: task._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/accept (Nhận việc vặt - Atomic Race-Condition Safe)
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const { note, assigneePhone } = req.body;

    const existing = await MicroTask.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng việc vặt.' });
    }

    if (existing.requesterId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự nhận công việc do chính mình đăng.' });
    }

    const userPhone = assigneePhone || req.user.phone || '';

    // Atomic findOneAndUpdate prevents race conditions
    const updated = await MicroTask.findOneAndUpdate(
      { _id: req.params.id, status: 'open' },
      {
        status: 'accepted',
        assigneeId: req.user._id,
        assigneeName: req.user.name || 'Sinh viên',
        assigneePhone: userPhone,
        note: note || '',
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Rất tiếc! Công việc này vừa có bạn khác nhận hoặc không còn mở.',
      });
    }

    // Send in-app notification to task requester
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/complete (Đánh dấu hoàn thành - Requester, Assignee hoặc Admin)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.' });

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();

    if (req.user.role !== 'admin' && !isRequester && !isAssignee) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật trạng thái việc này.' });
    }

    task.status = 'completed';
    await task.save();

    // Send notification to the other party
    try {
      const targetUserId = isRequester ? task.assigneeId : task.requesterId;
      if (targetUserId) {
        await Notification.create({
          userId: targetUserId,
          title: 'Việc vặt đã hoàn thành ✅',
          message: `Công việc "${task.title}" đã được xác nhận hoàn tất. Cảm ơn bạn đã hỗ trợ!`,
          type: 'task',
          link: '/tasks',
        });
      }
    } catch (notifErr) {
      console.warn('Task complete notification error:', notifErr.message);
    }

    res.json({ message: 'Đã xác nhận hoàn thành việc vặt!', task: { ...task.toObject(), id: task._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id (Hủy bài đăng việc vặt)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt.' });

    if (req.user.role !== 'admin' && task.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này.' });
    }

    if (task.status === 'in_progress' || task.status === 'accepted') {
      return res.status(400).json({ error: 'Công việc đang có người thực hiện, không thể xóa ngay.' });
    }

    await MicroTask.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa bài đăng việc vặt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
