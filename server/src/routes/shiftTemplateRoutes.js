import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middlewares/auth.js';
import { ShiftTemplate } from '../models/ShiftTemplate.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';

const router = express.Router();
router.use(authenticate);

// GET /api/shift-templates
router.get('/', async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.user.role === 'employer') {
      filter.employerUserId = req.user._id;
    } else if (req.user.role === 'admin') {
      if (req.query.employerId) filter.employerUserId = req.query.employerId;
    } else {
      return res.status(403).json({ error: 'Không có quyền xem mẫu ca của nhà tuyển dụng.', code: 'FORBIDDEN' });
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

// POST /api/shift-templates (Validate jobId ownership, time range and dayOfWeek)
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
      effectiveFrom,
      effectiveTo,
    } = req.body;

    if (dayOfWeek === undefined || !startTime || !endTime || !positionTitle) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin mẫu ca (vị trí, thứ trong tuần, giờ bắt đầu và kết thúc).', code: 'MISSING_FIELDS' });
    }

    const numDay = Number(dayOfWeek);
    if (isNaN(numDay) || numDay < 0 || numDay > 6) {
      return res.status(400).json({ error: 'Thứ trong tuần không hợp lệ (0 = Chủ Nhật, 1..6 = Thứ Hai..Thứ Bảy).', code: 'INVALID_DAY' });
    }

    let defaultWorkplace = workplace || '';
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      // Validate that jobId belongs to this employer!
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Không tìm thấy công việc tương ứng.', code: 'JOB_NOT_FOUND' });
      }
      if (req.user.role !== 'admin') {
        let ownerId = job.employerUserId || job.employer;
        if (!ownerId && (job.employerProfileId || job.employerId)) {
          const profile = await EmployerProfile.findById(job.employerProfileId || job.employerId);
          ownerId = profile?.userId || job.employerId;
        }
        if (String(ownerId) !== String(req.user._id)) {
          return res.status(403).json({ error: 'Bạn không sở hữu tin tuyển dụng này để gắn vào mẫu ca.', code: 'FORBIDDEN' });
        }
      }
      defaultWorkplace = defaultWorkplace || job.storeName || '';
    }

    const template = await ShiftTemplate.create({
      employerUserId: req.user._id,
      jobId: jobId && mongoose.Types.ObjectId.isValid(jobId) ? jobId : null,
      workplace: defaultWorkplace,
      positionTitle: String(positionTitle).trim(),
      dayOfWeek: numDay,
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      requiredHeadcount: Math.max(1, Number(requiredHeadcount) || 1),
      wageOverride: wageOverride && Number(wageOverride) > 0 ? Number(wageOverride) : null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
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
    if (updates.positionTitle) template.positionTitle = String(updates.positionTitle).trim();
    if (updates.dayOfWeek !== undefined) {
      const numDay = Number(updates.dayOfWeek);
      if (!isNaN(numDay) && numDay >= 0 && numDay <= 6) {
        template.dayOfWeek = numDay;
      }
    }
    if (updates.startTime) template.startTime = String(updates.startTime).trim();
    if (updates.endTime) template.endTime = String(updates.endTime).trim();
    if (updates.requiredHeadcount !== undefined) template.requiredHeadcount = Math.max(1, Number(updates.requiredHeadcount) || 1);
    if (updates.wageOverride !== undefined) template.wageOverride = Number(updates.wageOverride) || null;
    if (updates.workplace) template.workplace = String(updates.workplace).trim();
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

