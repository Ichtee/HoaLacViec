import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middlewares/auth.js';
import { ShiftTemplate } from '../models/ShiftTemplate.js';
import { Job } from '../models/Job.js';

const router = express.Router();
router.use(authenticate);

// GET /api/shift-templates
router.get('/', async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.user.role === 'employer') {
      filter.employerUserId = req.user._id;
    } else if (req.query.employerId) {
      filter.employerUserId = req.query.employerId;
    }

    if (req.query.dayOfWeek !== undefined) {
      filter.dayOfWeek = Number(req.query.dayOfWeek);
    }
    if (req.query.jobId) {
      filter.jobId = req.query.jobId;
    }

    const templates = await ShiftTemplate.find(filter)
      .populate('jobId', 'title storeName address')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    res.json(templates.map(t => ({ ...t, id: t._id })));
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-templates
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền tạo mẫu ca.', code: 'FORBIDDEN' });
    }

    const {
      jobId,
      positionTitle,
      dayOfWeek,
      startTime,
      endTime,
      requiredHeadcount = 1,
      wageOverride,
      workplace,
    } = req.body;

    if (dayOfWeek === undefined || !startTime || !endTime || !positionTitle) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin mẫu ca.', code: 'MISSING_FIELDS' });
    }

    let defaultWorkplace = workplace || '';
    if (jobId && !defaultWorkplace) {
      const job = await Job.findById(jobId);
      if (job) defaultWorkplace = job.storeName;
    }

    const template = await ShiftTemplate.create({
      employerUserId: req.user._id,
      jobId: jobId || null,
      workplace: defaultWorkplace,
      positionTitle,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      requiredHeadcount: Number(requiredHeadcount) || 1,
      wageOverride: wageOverride ? Number(wageOverride) : null,
      active: true,
    });

    res.status(201).json({ message: 'Tạo mẫu ca thành công', template: { ...template.toObject(), id: template._id } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shift-templates/:id
router.put('/:id', async (req, res, next) => {
  try {
    const template = await ShiftTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Không tìm thấy mẫu ca.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin' && template.employerUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa mẫu ca này.', code: 'FORBIDDEN' });
    }

    const updates = req.body;
    if (updates.positionTitle) template.positionTitle = updates.positionTitle;
    if (updates.dayOfWeek !== undefined) template.dayOfWeek = Number(updates.dayOfWeek);
    if (updates.startTime) template.startTime = updates.startTime;
    if (updates.endTime) template.endTime = updates.endTime;
    if (updates.requiredHeadcount !== undefined) template.requiredHeadcount = Number(updates.requiredHeadcount);
    if (updates.wageOverride !== undefined) template.wageOverride = updates.wageOverride;
    if (updates.workplace) template.workplace = updates.workplace;
    if (updates.active !== undefined) template.active = Boolean(updates.active);

    await template.save();
    res.json({ message: 'Cập nhật mẫu ca thành công', template: { ...template.toObject(), id: template._id } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shift-templates/:id (Soft disable)
router.delete('/:id', async (req, res, next) => {
  try {
    const template = await ShiftTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Không tìm thấy mẫu ca.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin' && template.employerUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa mẫu ca này.', code: 'FORBIDDEN' });
    }

    template.active = false;
    await template.save();
    res.json({ message: 'Đã vô hiệu hóa mẫu ca thành công', id: template._id });
  } catch (err) {
    next(err);
  }
});

export default router;
