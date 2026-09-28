import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middlewares/auth.js';
import { TimeOffRequest } from '../models/TimeOffRequest.js';
import { Employment } from '../models/Employment.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();
router.use(authenticate);

// GET /api/time-off
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'student') {
      filter.employeeUserId = req.user._id;
    } else if (req.user.role === 'employer') {
      filter.employerUserId = req.user._id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const requests = await TimeOffRequest.find(filter)
      .populate('employeeUserId', 'name phone email avatar')
      .populate('employerUserId', 'name phone storeName')
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests.map(r => ({ ...r, id: r._id })));
  } catch (err) {
    next(err);
  }
});

// POST /api/time-off (Student submits time off)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Chỉ nhân viên/sinh viên mới có thể nộp đơn xin nghỉ.', code: 'FORBIDDEN' });
    }

    const { employerUserId, startDate, endDate, reason } = req.body;
    if (!employerUserId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ người quản lý và thời gian nghỉ.', code: 'MISSING_FIELDS' });
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    if (sDate > eDate) {
      return res.status(400).json({ error: 'Thời gian bắt đầu nghỉ phải trước thời gian kết thúc.', code: 'INVALID_DATES' });
    }

    const employment = await Employment.findOne({
      employeeUserId: req.user._id,
      employerUserId,
      status: { $in: ['active', 'onboarding'] },
    });

    const request = await TimeOffRequest.create({
      employeeUserId: req.user._id,
      employerUserId,
      employmentId: employment?._id || null,
      startDate: sDate,
      endDate: eDate,
      reason: reason || '',
      status: 'pending',
    });

    // Notify employer
    try {
      await Notification.create({
        userId: employerUserId,
        title: 'Đơn xin nghỉ phép mới 📝',
        message: `Nhân viên ${req.user.name} đã nộp đơn xin nghỉ từ ${sDate.toLocaleDateString('vi-VN')} đến ${eDate.toLocaleDateString('vi-VN')}.`,
        type: 'time_off',
        link: '/employer/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify employer:', notifErr.message);
    }

    res.status(201).json({ message: 'Nộp đơn xin nghỉ thành công', request: { ...request.toObject(), id: request._id } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/time-off/:id/status (Employer approves or rejects)
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái xử lý không hợp lệ.', code: 'INVALID_STATUS' });
    }

    const request = await TimeOffRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy đơn xin nghỉ.', code: 'NOT_FOUND' });
    }

    if (req.user.role === 'employer' && request.employerUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền duyệt đơn này.', code: 'FORBIDDEN' });
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote || '';
    await request.save();

    // Notify student
    try {
      await Notification.create({
        userId: request.employeeUserId,
        title: status === 'approved' ? 'Đơn xin nghỉ đã được duyệt! ✅' : 'Đơn xin nghỉ đã bị từ chối ⚠️',
        message: `Đơn xin nghỉ của bạn đã được cập nhật: ${status === 'approved' ? 'Chấp thuận' : 'Từ chối'}. ${reviewNote ? `Ghi chú: ${reviewNote}` : ''}`,
        type: 'time_off',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student:', notifErr.message);
    }

    res.json({ message: 'Đã cập nhật trạng thái đơn xin nghỉ', request: { ...request.toObject(), id: request._id } });
  } catch (err) {
    next(err);
  }
});

export default router;
