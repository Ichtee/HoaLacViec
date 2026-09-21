import express from 'express';
import { MicroTask } from '../models/MicroTask.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/tasks (Lấy danh sách việc vặt)
router.get('/', async (req, res) => {
  try {
    const { category, status, requesterId } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (status) filter.status = status;
    if (requesterId) filter.requesterId = requesterId;

    const tasks = await MicroTask.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks (Đăng việc vặt mới - Authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title, category, description, reward, location,
      deadline, requesterName, requesterPhone
    } = req.body;

    if (!title || !description || !reward) {
      return res.status(400).json({ error: 'Vui lòng điền đủ tiêu đề, mô tả và tiền thù lao.' });
    }

    const task = await MicroTask.create({
      title,
      category: category || 'di_cho',
      description,
      reward: Number(reward),
      location: location || 'Hòa Lạc',
      deadline: deadline || 'Hôm nay',
      requesterId: req.user._id,
      requesterName: requesterName || req.user.name || 'Sinh viên',
      requesterPhone: requesterPhone || req.user.phone || '',
      status: 'open',
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/accept (Sinh viên nhận việc vặt - Authenticated)
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const { assigneeName, assigneePhone, note } = req.body;
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc' });

    if (task.requesterId && task.requesterId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự nhận việc do chính mình đăng.' });
    }

    if (task.status !== 'open') {
      return res.status(400).json({ error: 'Công việc này đã có bạn khác nhận rồi!' });
    }

    task.status = 'accepted';
    task.assigneeId = req.user._id;
    task.assigneeName = assigneeName || req.user.name || 'Sinh viên';
    task.assigneePhone = assigneePhone || req.user.phone || '';
    task.note = note || '';
    await task.save();

    res.json({ message: 'Đã nhận việc thành công!', task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/complete (Đánh dấu hoàn thành - Chỉ người đăng hoặc admin)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc' });

    if (req.user.role !== 'admin' && task.requesterId && task.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ người nhờ việc mới có quyền xác nhận hoàn thành.' });
    }

    task.status = 'completed';
    await task.save();

    res.json({ message: 'Đã hoàn thành việc vặt!', task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id (Hủy việc - Chỉ người đăng hoặc admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await MicroTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy việc vặt' });

    if (req.user.role !== 'admin' && task.requesterId && task.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này.' });
    }

    await MicroTask.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa bài đăng việc vặt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

