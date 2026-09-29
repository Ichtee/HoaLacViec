import express from 'express';
import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';
import { evaluateAttendanceGPS, clampRadius } from '../utils/geoHelper.js';
import {
  createShift,
  publishShifts,
  preflightPublish,
  acknowledgeShift,
  acceptShift,
  declineShift,
  rescheduleShift,
  cancelShift,
  recordAttendanceStart,
  recordAttendanceEnd,
  recordAttendanceNoShow,
  approveAttendance,
  markPayrollReady,
  markPaid,
  adjustWorkedTime,
  disputeShift,
  resolveDispute,
  generateDraftShiftsFromTemplates,
} from '../services/schedulingService.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  getAllowedShiftActions,
} from '../domain/shiftLifecycle.js';

const router = express.Router();
router.use(authenticate);

async function resolveEmployerUserId(shift) {
  let employerTarget = shift.employerUserId;
  if (!employerTarget && shift.employerId) {
    const empUser = await User.findById(shift.employerId);
    if (empUser) {
      employerTarget = empUser._id;
    } else {
      const empProf = await EmployerProfile.findById(shift.employerId);
      if (empProf) employerTarget = empProf.userId;
    }
  }
  return employerTarget;
}

// GET /api/shifts (List shifts with filters)
router.get('/', async (req, res, next) => {
  try {
    const { studentId, employeeId, employerId, storeId, storeName, status, scheduleStatus, attendanceStatus, payrollStatus, date, startDate, endDate } = req.query;
    const filter = {};

    const isEmployee = ['student', 'worker', 'freelancer'].includes(req.user.role);

    if (isEmployee) {
      filter.$or = [
        { employeeUserId: req.user._id },
        { studentUserId: req.user._id },
        { studentId: req.user._id },
      ];
      // Employee only sees published or cancelled shifts (never drafts)
      filter.scheduleStatus = { $in: [SCHEDULE_STATUSES.PUBLISHED, SCHEDULE_STATUSES.CANCELLED] };
    } else if (req.user.role === 'employer') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const employerIds = [req.user._id];
      if (profile) employerIds.push(profile._id);

      filter.$or = [
        { employerUserId: req.user._id },
        { employerId: { $in: employerIds } },
      ];

      // Optional filter by employee for employer
      const targetEmp = employeeId || studentId;
      if (targetEmp && mongoose.Types.ObjectId.isValid(targetEmp)) {
        filter.studentUserId = targetEmp;
      }
    } else if (req.user.role === 'admin') {
      const targetEmp = employeeId || studentId;
      if (targetEmp) {
        filter.$or = [{ employeeUserId: targetEmp }, { studentUserId: targetEmp }, { studentId: targetEmp }];
      }
      const emp = employerId || storeId;
      if (emp || storeName) {
        const orList = [];
        if (emp) orList.push({ employerUserId: emp }, { employerId: emp });
        if (storeName) orList.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
        if (orList.length > 0) filter.$or = orList;
      }
    }

    if (scheduleStatus) {
      filter.scheduleStatus = scheduleStatus;
    }
    if (attendanceStatus) {
      filter.attendanceStatus = attendanceStatus;
    }
    if (payrollStatus) {
      filter.payrollStatus = payrollStatus;
    }

    if (status) {
      if (status === 'scheduled') {
        filter.status = { $in: ['scheduled', 'published', 'acknowledged'] };
      } else if (status === 'completed' || status === 'approved') {
        filter.status = { $in: ['approved', 'completed', 'payroll_ready', 'paid'] };
      } else {
        filter.status = status;
      }
    }

    if (date) {
      filter.date = date;
    } else if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const shifts = await Shift.find(filter)
      .populate('jobId', 'title storeName address location')
      .populate('employmentId', 'positionTitle workplace wageRate status')
      .populate('employeeUserId', 'name phone email avatar')
      .populate('studentUserId', 'name phone email avatar')
      .sort({ date: -1, startTime: 1 })
      .lean();

    const formatted = shifts.map((s) => ({
      ...s,
      id: s._id,
      status: s.status === 'completed' ? 'approved' : s.status,
      allowedActions: getAllowedShiftActions(s, req.user),
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã ca làm không hợp lệ.', code: 'INVALID_ID' });
    }

    const shift = await Shift.findById(req.params.id)
      .populate('jobId', 'title storeName address location')
      .populate('employmentId', 'positionTitle workplace wageRate status')
      .populate('employeeUserId', 'name email phone avatar')
      .populate('studentUserId', 'name email phone avatar')
      .lean();

    if (!shift) {
      return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin') {
      const isEmployee = ['student', 'worker', 'freelancer'].includes(req.user.role);
      const isAssigned =
        String(shift.employeeUserId?._id || shift.employeeUserId || '') === String(req.user._id) ||
        String(shift.studentUserId?._id || shift.studentUserId || '') === String(req.user._id) ||
        String(shift.studentId?._id || shift.studentId || '') === String(req.user._id);

      const isEmployerOwner =
        String(shift.employerUserId?._id || shift.employerUserId || '') === String(req.user._id) ||
        String(shift.employerId?._id || shift.employerId || '') === String(req.user._id);

      if (isEmployee) {
        if (!isAssigned) {
          return res.status(403).json({ error: 'Bạn không có quyền xem thông tin ca làm việc này.', code: 'FORBIDDEN' });
        }
        if (shift.scheduleStatus === SCHEDULE_STATUSES.DRAFT) {
          return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });
        }
      } else if (!isEmployerOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xem thông tin ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    res.json({
      ...shift,
      id: shift._id,
      allowedActions: getAllowedShiftActions(shift, req.user),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts (Create shift from active Employment)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền tạo ca làm việc.', code: 'FORBIDDEN' });
    }

    const {
      employmentId,
      studentUserId,
      employeeUserId,
      jobId,
      date,
      startTime,
      endTime,
      role,
      positionTitle,
      wageRate,
      isDraft,
      shiftTemplateId,
    } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày, giờ bắt đầu và kết thúc ca làm.', code: 'MISSING_FIELDS' });
    }

    const result = await createShift(
      {
        employmentId,
        studentUserId: employeeUserId || studentUserId,
        employeeUserId: employeeUserId || studentUserId,
        jobId,
        date,
        startTime,
        endTime,
        role: positionTitle || role,
        positionTitle: positionTitle || role,
        wageRate,
        isDraft: Boolean(isDraft),
        shiftTemplateId,
      },
      req.user
    );

    res.status(201).json({
      message: isDraft ? 'Đã tạo ca làm ở trạng thái nháp.' : 'Phân ca làm việc và công bố lịch thành công!',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/preflight (Preflight conflict checks prior to publishing)
router.post('/preflight', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền kiểm tra lịch công bố.', code: 'FORBIDDEN' });
    }

    const { startDate, endDate, shiftIds } = req.body;
    const result = await preflightPublish({
      employerId: req.user._id,
      startDate,
      endDate,
      shiftIds,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/publish (Publish draft shifts in bulk)
router.post('/publish', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền công bố lịch làm.', code: 'FORBIDDEN' });
    }

    const { startDate, endDate, shiftIds } = req.body;
    const result = await publishShifts({
      employerId: req.user._id,
      startDate,
      endDate,
      shiftIds,
      actor: req.user,
    });

    res.json({
      message: `Đã công bố ${result.publishedCount} ca làm việc thành công!`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/generate-from-templates (Generate draft shifts from ShiftTemplate)
router.post('/generate-from-templates', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền sinh ca từ mẫu.', code: 'FORBIDDEN' });
    }

    const { startDate, endDate, jobId } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày bắt đầu và kết thúc.', code: 'MISSING_FIELDS' });
    }

    const result = await generateDraftShiftsFromTemplates({
      employerId: req.user._id,
      startDate,
      endDate,
      jobId,
    });

    res.json({
      message: `Đã tự động tạo ${result.generatedCount} ca nháp từ mẫu!`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/acknowledge (Disabled for employees)
router.post('/:id/acknowledge', async (req, res) => {
  return res.status(403).json({
    error: 'Tính năng này không còn áp dụng cho người lao động. Lịch làm và chấm công do nhà tuyển dụng trực tiếp quản lý.',
    code: 'FORBIDDEN',
  });
});

// POST /api/shifts/:id/accept (Disabled for employees)
router.post('/:id/accept', async (req, res) => {
  return res.status(403).json({
    error: 'Tính năng này không còn áp dụng cho người lao động. Lịch làm và chấm công do nhà tuyển dụng trực tiếp quản lý.',
    code: 'FORBIDDEN',
  });
});

// POST /api/shifts/:id/decline (Disabled for employees)
router.post('/:id/decline', async (req, res) => {
  return res.status(403).json({
    error: 'Tính năng này không còn áp dụng cho người lao động. Lịch làm và chấm công do nhà tuyển dụng trực tiếp quản lý.',
    code: 'FORBIDDEN',
  });
});

// PUT /api/shifts/:id/reschedule (Employer reschedules shift)
router.put('/:id/reschedule', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền đổi lịch ca làm.', code: 'FORBIDDEN' });
    }
    const result = await rescheduleShift(req.params.id, req.body, req.user);
    res.json({ message: 'Đã đổi lịch ca làm thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/cancel (Employer cancels shift)
router.post('/:id/cancel', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền hủy ca làm.', code: 'FORBIDDEN' });
    }
    const { reason } = req.body;
    const result = await cancelShift(req.params.id, req.user, reason);
    res.json({ message: 'Đã hủy ca làm việc thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/attendance/start (Employer records employee start/present)
router.post('/:id/attendance/start', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền tự điểm danh. Chấm công do nhà tuyển dụng thực hiện.', code: 'FORBIDDEN' });
    }
    const { actualTime, note } = req.body;
    const result = await recordAttendanceStart(req.params.id, req.user, { actualTime, note });
    res.json({ message: 'Ghi nhận nhân viên vào ca thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/attendance/end (Employer records employee end of shift)
router.post('/:id/attendance/end', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền tự điểm danh kết thúc ca.', code: 'FORBIDDEN' });
    }
    const { actualTime, note } = req.body;
    const result = await recordAttendanceEnd(req.params.id, req.user, { actualTime, note });
    res.json({ message: 'Ghi nhận nhân viên kết thúc ca thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/attendance/no-show (Employer records employee absence)
router.post('/:id/attendance/no-show', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền thực hiện thao tác này.', code: 'FORBIDDEN' });
    }
    const { reason, note } = req.body;
    const result = await recordAttendanceNoShow(req.params.id, req.user, { reason, note });
    res.json({ message: 'Ghi nhận nhân viên vắng mặt thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// Compatibility Route: POST /api/shifts/:id/checkin
router.post('/:id/checkin', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền tự điểm danh check-in.', code: 'FORBIDDEN' });
    }
    const { actualTime, note } = req.body;
    const result = await recordAttendanceStart(req.params.id, req.user, { actualTime, note });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Compatibility Route: POST /api/shifts/:id/checkout
router.post('/:id/checkout', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền tự điểm danh check-out.', code: 'FORBIDDEN' });
    }
    const { actualTime, note } = req.body;
    const result = await recordAttendanceEnd(req.params.id, req.user, { actualTime, note });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/approve (Duyệt công)
router.post('/:id/approve', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền duyệt công.', code: 'FORBIDDEN' });
    }
    const { approvedMinutes, managerNote } = req.body;
    const result = await approveAttendance(req.params.id, req.user, { approvedMinutes, managerNote });
    res.json({ message: 'Đã xác nhận duyệt công làm việc thành công', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/payroll-ready (Sẵn sàng tính lương)
router.post('/:id/payroll-ready', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền thực hiện thao tác này.', code: 'FORBIDDEN' });
    }
    const result = await markPayrollReady(req.params.id, req.user);
    res.json({ message: 'Đã chuyển ca làm sang trạng thái sẵn sàng tính lương.', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/pay (Chi trả lương)
router.post('/:id/pay', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền thanh toán lương.', code: 'FORBIDDEN' });
    }
    const { paymentReference, note } = req.body;
    const result = await markPaid(req.params.id, req.user, { paymentReference, note });
    res.json({ message: 'Đã xác nhận hoàn tất chi trả lương cho ca làm.', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: PUT /api/shifts/:id/adjust (Điều chỉnh giờ làm)
router.put('/:id/adjust', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền điều chỉnh giờ làm việc.', code: 'FORBIDDEN' });
    }
    const { adjustedMinutes, workedMinutes, reason } = req.body;
    const mins = adjustedMinutes !== undefined ? adjustedMinutes : workedMinutes;
    const result = await adjustWorkedTime(req.params.id, req.user, { adjustedMinutes: mins, reason });
    res.json({ message: 'Đã điều chỉnh thời gian làm việc thành công', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/dispute (Báo đối soát công - Disabled for employees)
router.post('/:id/dispute', async (req, res) => {
  return res.status(403).json({
    error: 'Tính năng khiếu nại ca trong module lịch đã được vô hiệu hóa. Vui lòng liên hệ nhà tuyển dụng để điều chỉnh giờ công.',
    code: 'FORBIDDEN',
  });
});

// ACTION: POST /api/shifts/:id/resolve-dispute (Giải quyết đối soát công)
router.post('/:id/resolve-dispute', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền giải quyết đối soát.', code: 'FORBIDDEN' });
    }
    const { resolution, adjustedMinutes, note } = req.body;
    const result = await resolveDispute(req.params.id, req.user, { resolution, adjustedMinutes, note });
    res.json({ message: 'Đã xử lý đối soát thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Người lao động không có quyền xóa ca làm.', code: 'FORBIDDEN' });
    }
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (shift.scheduleStatus === SCHEDULE_STATUSES.DRAFT || shift.status === 'draft') {
      await Shift.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Đã xóa ca nháp thành công', id: req.params.id });
    }

    const result = await cancelShift(req.params.id, req.user, req.body?.reason || 'Hủy ca đã công bố');
    res.json({ message: 'Ca làm đã được chuyển sang trạng thái hủy (không xóa lịch sử).', ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
