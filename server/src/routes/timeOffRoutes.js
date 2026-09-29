import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middlewares/auth.js';
import { TimeOffRequest } from '../models/TimeOffRequest.js';
import { Employment } from '../models/Employment.js';
import { Shift } from '../models/Shift.js';
import { Notification } from '../models/Notification.js';
import { SCHEDULE_STATUSES, ASSIGNMENT_STATUSES } from '../domain/shiftLifecycle.js';

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
      .populate('employmentId', 'workplace positionTitle wageRate')
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests.map((r) => ({ ...r, id: r._id })));
  } catch (err) {
    next(err);
  }
});

// POST /api/time-off (Student submits time off - MUST require valid active employment)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Chỉ nhân viên/sinh viên mới có thể nộp đơn xin nghỉ.', code: 'FORBIDDEN' });
    }

    const { employmentId, employerUserId, startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thời gian bắt đầu và kết thúc nghỉ phép.', code: 'MISSING_FIELDS' });
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate > eDate) {
      return res.status(400).json({ error: 'Thời gian bắt đầu nghỉ phải trước hoặc bằng thời gian kết thúc.', code: 'INVALID_DATES' });
    }

    // Require valid, active employment belonging to this student
    const employmentFilter = {
      employeeUserId: req.user._id,
      status: { $in: ['active', 'onboarding'] },
    };

    if (employmentId && mongoose.Types.ObjectId.isValid(employmentId)) {
      employmentFilter._id = employmentId;
    } else if (employerUserId && mongoose.Types.ObjectId.isValid(employerUserId)) {
      employmentFilter.employerUserId = employerUserId;
    }

    const employment = await Employment.findOne(employmentFilter);
    if (!employment) {
      return res.status(400).json({
        error: 'Bạn không có quan hệ việc làm đang hoạt động tại cơ sở này để nộp đơn xin nghỉ.',
        code: 'EMPLOYMENT_REQUIRED',
      });
    }

    const authoritativeEmployerId = employment.employerUserId;

    // Check if there is already an active pending or approved request overlapping these dates
    const existing = await TimeOffRequest.findOne({
      employeeUserId: req.user._id,
      employerUserId: authoritativeEmployerId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: eDate },
      endDate: { $gte: sDate },
    });

    if (existing) {
      return res.status(409).json({
        error: `Bạn đã có đơn nghỉ phép (${existing.status}) trùng với khoảng thời gian này rồi.`,
        code: 'DUPLICATE_TIME_OFF',
      });
    }

    const request = await TimeOffRequest.create({
      employeeUserId: req.user._id,
      employerUserId: authoritativeEmployerId,
      employmentId: employment._id,
      startDate: sDate,
      endDate: eDate,
      reason: reason ? String(reason).trim() : '',
      status: 'pending',
    });

    // Notify employer
    try {
      await Notification.create({
        userId: authoritativeEmployerId,
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

// PUT /api/time-off/:id/status (Strict permission matrix & terminal protection)
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, reviewNote, conflictingShiftAction = 'warn' } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái xử lý không hợp lệ.', code: 'INVALID_STATUS' });
    }

    const request = await TimeOffRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy đơn xin nghỉ.', code: 'NOT_FOUND' });
    }

    // Terminal state protection: Cannot reopen or modify a request that is already terminal
    if (['approved', 'rejected', 'cancelled'].includes(request.status)) {
      return res.status(400).json({
        error: `Đơn xin nghỉ phép đã ở trạng thái kết thúc "${request.status}" và không thể thay đổi.`,
        code: 'REQUEST_TERMINAL',
      });
    }

    // Role & Ownership Permissions Matrix
    if (req.user.role === 'student') {
      if (String(request.employeeUserId) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Bạn không có quyền thao tác trên đơn nghỉ phép của người khác.', code: 'FORBIDDEN' });
      }
      if (status !== 'cancelled') {
        return res.status(403).json({ error: 'Sinh viên chỉ có thể hủy đơn xin nghỉ của mình.', code: 'FORBIDDEN' });
      }
    } else if (req.user.role === 'employer') {
      if (String(request.employerUserId) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Bạn không có quyền xét duyệt đơn nghỉ phép của cơ sở khác.', code: 'FORBIDDEN' });
      }
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Quản lý chỉ có thể duyệt (approved) hoặc từ chối (rejected) đơn nghỉ.', code: 'INVALID_STATUS' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền thao tác.', code: 'FORBIDDEN' });
    }

    request.status = status;
    request.reviewNote = reviewNote ? String(reviewNote).trim() : request.reviewNote;
    request.reviewedAt = new Date();
    await request.save();

    // If approved, handle overlapping published shifts
    let affectedShifts = [];
    if (status === 'approved') {
      const eDateEnd = new Date(request.endDate);
      eDateEnd.setHours(23, 59, 59, 999);

      const overlappingShifts = await Shift.find({
        studentUserId: request.employeeUserId,
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        startAt: { $lte: eDateEnd },
        endAt: { $gte: request.startDate },
      });

      if (overlappingShifts.length > 0) {
        if (conflictingShiftAction === 'unassign') {
          for (const s of overlappingShifts) {
            s.studentUserId = null;
            s.studentId = null;
            s.studentName = '';
            s.studentPhone = '';
            s.assignmentStatus = ASSIGNMENT_STATUSES.UNASSIGNED;
            s.history.push({
              status: s.status,
              scheduleStatus: s.scheduleStatus,
              attendanceStatus: s.attendanceStatus,
              payrollStatus: s.payrollStatus,
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Gỡ phân công do nhân viên được duyệt đơn nghỉ phép',
            });
            await s.save();
          }
        } else if (conflictingShiftAction === 'cancel') {
          for (const s of overlappingShifts) {
            s.scheduleStatus = SCHEDULE_STATUSES.CANCELLED;
            s.cancelReason = 'Hủy ca do nhân viên được duyệt đơn nghỉ phép';
            s.history.push({
              status: SCHEDULE_STATUSES.CANCELLED,
              scheduleStatus: SCHEDULE_STATUSES.CANCELLED,
              attendanceStatus: s.attendanceStatus,
              payrollStatus: s.payrollStatus,
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Hủy ca do nhân viên được duyệt đơn nghỉ phép',
            });
            await s.save();
          }
        }
        affectedShifts = overlappingShifts;
      }
    }

    // Send notification
    try {
      if (req.user.role === 'employer' || req.user.role === 'admin') {
        await Notification.create({
          userId: request.employeeUserId,
          title: `Đơn xin nghỉ phép đã được ${status === 'approved' ? 'duyệt ✅' : 'từ chối ❌'}`,
          message: `Quản lý đã ${status === 'approved' ? 'chấp thuận' : 'từ chối'} đơn nghỉ từ ${new Date(request.startDate).toLocaleDateString('vi-VN')} đến ${new Date(request.endDate).toLocaleDateString('vi-VN')}.${request.reviewNote ? ` Ghi chú: ${request.reviewNote}` : ''}`,
          type: 'time_off',
          link: '/student/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to notify employee of time-off status:', notifErr.message);
    }

    res.json({
      message: `Đã cập nhật trạng thái đơn nghỉ sang "${status}".`,
      request: { ...request.toObject(), id: request._id },
      affectedShiftsCount: affectedShifts.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
