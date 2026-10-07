import express from 'express';
import mongoose from 'mongoose';
import { JobAlert, MAX_ALERTS_PER_USER } from '../models/JobAlert.js';
import { authenticate, requireActiveUser } from '../middlewares/auth.js';
import { LABOR_ROLES } from '../utils/applicationDto.js';

const router = express.Router();
router.use(authenticate, requireActiveUser, (req, res, next) => {
  if (!LABOR_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Chỉ người tìm việc mới có thể đặt thông báo việc mới.', code: 'FORBIDDEN' });
  }
  next();
});

const TYPES = ['', 'part_time', 'shift', 'hourly', 'event'];

// GET /api/job-alerts
router.get('/', async (req, res, next) => {
  try {
    res.json(await JobAlert.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean());
  } catch (err) {
    next(err);
  }
});

// POST /api/job-alerts
router.post('/', async (req, res, next) => {
  try {
    const { keyword = '', category = '', area = '', type = '', minSalary = 0 } = req.body;
    const salary = Number(minSalary) || 0;
    if (!TYPES.includes(type) || salary < 0 || salary > 10000000) {
      return res.status(400).json({ error: 'Bộ lọc không hợp lệ.', code: 'INVALID_FILTER' });
    }
    if (![keyword, category, area].every((v) => typeof v === 'string')) {
      return res.status(400).json({ error: 'Bộ lọc không hợp lệ.', code: 'INVALID_FILTER' });
    }
    if (!keyword.trim() && !category && !area && !type && !salary) {
      return res.status(400).json({ error: 'Hãy chọn ít nhất một điều kiện lọc.', code: 'EMPTY_FILTER' });
    }
    if (await JobAlert.countDocuments({ userId: req.user._id }) >= MAX_ALERTS_PER_USER) {
      return res.status(409).json({ error: `Bạn chỉ có thể đặt tối đa ${MAX_ALERTS_PER_USER} bộ lọc.`, code: 'LIMIT_REACHED' });
    }
    const alert = await JobAlert.create({ userId: req.user._id, keyword, category, area, type, minSalary: salary });
    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/job-alerts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã bộ lọc không hợp lệ.', code: 'INVALID_ID' });
    }
    const removed = await JobAlert.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!removed) return res.status(404).json({ error: 'Không tìm thấy bộ lọc.', code: 'NOT_FOUND' });
    res.json({ message: 'Đã xóa bộ lọc.' });
  } catch (err) {
    next(err);
  }
});

export default router;
