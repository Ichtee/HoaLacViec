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
    const { studentId, employerId, storeId, storeName, status, scheduleStatus, attendanceStatus, payrollStatus, date, startDate, endDate } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      filter.$or = [
        { studentUserId: req.user._id },
        { studentId: req.user._id },
      ];
      // Student only sees published or cancelled shifts (hide drafts)
      filter.scheduleStatus = { $ne: SCHEDULE_STATUSES.DRAFT };
    } else if (req.user.role === 'employer') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const employerIds = [req.user._id];
      if (profile) employerIds.push(profile._id);

      filter.$or = [
        { employerUserId: req.user._id },
        { employerId: { $in: employerIds } },
      ];
    } else if (req.user.role === 'admin') {
      if (studentId) {
        filter.$or = [{ studentUserId: studentId }, { studentId }];
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
      .populate('studentUserId', 'name email phone avatar')
      .lean();

    if (!shift) {
      return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin') {
      const isStudent =
        (shift.studentUserId && shift.studentUserId._id?.toString() === req.user._id.toString()) ||
        (shift.studentId && shift.studentId.toString() === req.user._id.toString());
      const isEmployer =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isStudent && !isEmployer) {
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

// POST /api/shifts (Create shift with eligibility & conflict checks)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền tạo ca làm việc.', code: 'FORBIDDEN' });
    }

    const {
      studentUserId,
      studentId,
      jobId,
      date,
      startTime,
      endTime,
      role,
      wageRate,
      isDraft,
      shiftTemplateId,
    } = req.body;

    const assignedStudentId = studentUserId || studentId;
    if (!date || !startTime || !endTime || !jobId) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin ca làm.', code: 'MISSING_FIELDS' });
    }

    const result = await createShift(
      {
        studentUserId: assignedStudentId,
        jobId,
        date,
        startTime,
        endTime,
        role,
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

// POST /api/shifts/:id/acknowledge (Student acknowledges shift schedule)
router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const result = await acknowledgeShift(req.params.id, req.user);
    res.json({ message: 'Đã xác nhận xem lịch ca làm việc thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/accept (Student accepts shift)
router.post('/:id/accept', async (req, res, next) => {
  try {
    const result = await acceptShift(req.params.id, req.user);
    res.json({ message: 'Đã xác nhận nhận ca làm việc thành công!', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/decline (Student declines shift with reason)
router.post('/:id/decline', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await declineShift(req.params.id, req.user, reason);
    res.json({ message: 'Đã gửi phản hồi báo bận ca đến quản lý.', ...result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shifts/:id/reschedule (Reschedule shift with conflict validation)
router.put('/:id/reschedule', async (req, res, next) => {
  try {
    const result = await rescheduleShift(req.params.id, req.body, req.user);
    res.json({ message: 'Đã đổi lịch ca làm thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/cancel (Cancel shift)
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await cancelShift(req.params.id, req.user, reason);
    res.json({ message: 'Đã hủy ca làm việc thành công.', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/checkin
router.post('/:id/checkin', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('jobId');
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    // Authorization
    if (req.user.role !== 'admin' && String(shift.studentUserId) !== String(req.user._id) && String(shift.studentId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Bạn không có quyền check-in vào ca làm việc này.', code: 'FORBIDDEN' });
    }

    if (shift.scheduleStatus !== SCHEDULE_STATUSES.PUBLISHED) {
      return res.status(400).json({
        error: `Không thể điểm danh vào ca vì ca làm đang ở trạng thái "${shift.scheduleStatus}". Chỉ ca đã công bố mới có thể check-in.`,
        code: 'INVALID_STATUS',
      });
    }

    if (shift.attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) {
      return res.status(400).json({
        error: 'Bạn đã check-in vào ca này trước đó rồi.',
        code: 'ALREADY_CHECKED_IN',
      });
    }

    const { lat, lng, accuracy, timestamp, isManual, manualReason } = req.body;
    const now = new Date();
    const storeLocation = shift.jobId?.location;
    const configuredRadius = clampRadius(shift.jobId?.verificationRadius || 150);

    const evaluation = evaluateAttendanceGPS({
      deviceCoords: { lat, lng, accuracy, timestamp },
      storeLocation,
      configuredRadius,
      isManualRequest: Boolean(isManual),
      manualReason,
      currentTime: now,
    });

    const isVerified = evaluation.verified;
    const newAttStatus = isVerified ? ATTENDANCE_STATUSES.CHECKED_IN : ATTENDANCE_STATUSES.NEEDS_REVIEW;

    shift.attendanceStatus = newAttStatus;
    shift.assignmentStatus = ASSIGNMENT_STATUSES.ACCEPTED;
    shift.attendance = {
      ...shift.attendance,
      checkInAt: now,
      checkInCoords: {
        lat: evaluation.deviceCoords?.lat ?? null,
        lng: evaluation.deviceCoords?.lng ?? null,
        accuracy: evaluation.deviceCoords?.accuracy ?? null,
        timestamp: evaluation.deviceCoords?.timestamp ? new Date(evaluation.deviceCoords.timestamp) : now,
      },
      checkInDistanceMeters: evaluation.distanceMeters,
      checkInVerified: isVerified,
      checkInVerificationStatus: evaluation.verificationStatus,
      checkInReasonCode: evaluation.reasonCode,
      checkInConfiguredRadius: evaluation.configuredRadius,
      checkInManualReason: isManual ? manualReason : null,
      locationVerified: isVerified,
    };

    shift.history.push({
      status: shift.status,
      scheduleStatus: shift.scheduleStatus,
      attendanceStatus: newAttStatus,
      payrollStatus: shift.payrollStatus,
      changedAt: now,
      changedBy: req.user._id,
      note: `Check-in: ${evaluation.message || evaluation.reasonCode || 'Ghi nhận điểm danh'}`,
    });

    await shift.save();

    // Notify employer
    try {
      const employerTarget = await resolveEmployerUserId(shift);
      if (employerTarget) {
        await Notification.create({
          userId: employerTarget,
          title: `Sinh viên ${shift.studentName || ''} đã check-in vào ca`,
          message: `Check-in ca ${shift.startTime} - ${shift.endTime}. Trạng thái: ${evaluation.verified ? 'Xác thực GPS tự động' : `Cần duyệt (${evaluation.reasonCode})`}`,
          type: 'shift',
          link: '/employer/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to notify employer of checkin:', notifErr.message);
    }

    res.json({
      verified: isVerified,
      verificationStatus: evaluation.verificationStatus,
      reasonCode: evaluation.reasonCode,
      distanceMeters: evaluation.distanceMeters,
      message: evaluation.message,
      shift: { ...shift.toObject(), id: shift._id },
    });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/checkout
router.post('/:id/checkout', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('jobId');
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    // Authorization
    if (req.user.role !== 'admin' && String(shift.studentUserId) !== String(req.user._id) && String(shift.studentId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Bạn không có quyền check-out ca làm việc này.', code: 'FORBIDDEN' });
    }

    if (shift.attendanceStatus !== ATTENDANCE_STATUSES.CHECKED_IN && shift.status !== 'checked_in') {
      return res.status(400).json({
        error: 'Chỉ có thể check-out sau khi đã check-in vào ca làm việc.',
        code: 'INVALID_STATUS',
      });
    }

    const { lat, lng, accuracy, timestamp, isManual, manualReason } = req.body;
    const now = new Date();
    const storeLocation = shift.jobId?.location;
    const configuredRadius = clampRadius(shift.jobId?.verificationRadius || 150);

    const evaluation = evaluateAttendanceGPS({
      deviceCoords: { lat, lng, accuracy, timestamp },
      storeLocation,
      configuredRadius,
      isManualRequest: Boolean(isManual),
      manualReason,
      currentTime: now,
    });

    const isVerified = evaluation.verified;

    // Calculate worked minutes
    const checkInTime = shift.attendance?.checkInAt ? new Date(shift.attendance.checkInAt) : null;
    let workedMinutes = (shift.hours || 4) * 60;
    if (checkInTime) {
      const diffMs = now.getTime() - checkInTime.getTime();
      if (diffMs > 0) {
        workedMinutes = Math.min(Math.round(diffMs / (1000 * 60)), (shift.hours || 4) * 60 + 120);
      }
    }

    shift.attendanceStatus = ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW;
    shift.workedMinutes = workedMinutes;
    shift.hours = Math.round((workedMinutes / 60) * 100) / 100;
    shift.totalPay = Math.round(shift.hours * (shift.wageRate || 25000));

    shift.attendance = {
      ...shift.attendance,
      checkOutAt: now,
      checkOutCoords: {
        lat: evaluation.deviceCoords?.lat ?? null,
        lng: evaluation.deviceCoords?.lng ?? null,
        accuracy: evaluation.deviceCoords?.accuracy ?? null,
        timestamp: evaluation.deviceCoords?.timestamp ? new Date(evaluation.deviceCoords.timestamp) : now,
      },
      checkOutDistanceMeters: evaluation.distanceMeters,
      checkOutVerified: isVerified,
      checkOutVerificationStatus: evaluation.verificationStatus,
      checkOutReasonCode: evaluation.reasonCode,
      checkOutConfiguredRadius: evaluation.configuredRadius,
      checkOutManualReason: isManual ? manualReason : null,
    };

    shift.history.push({
      status: shift.status,
      scheduleStatus: shift.scheduleStatus,
      attendanceStatus: ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW,
      payrollStatus: shift.payrollStatus,
      changedAt: now,
      changedBy: req.user._id,
      note: `Check-out: ${workedMinutes} phút. ${evaluation.message || evaluation.reasonCode || ''}`,
    });

    await shift.save();

    // Notify employer
    try {
      const employerTarget = await resolveEmployerUserId(shift);
      if (employerTarget) {
        await Notification.create({
          userId: employerTarget,
          title: `Sinh viên ${shift.studentName || ''} đã check-out ra ca 🏁`,
          message: `Sinh viên đã hoàn thành ca làm ngày ${shift.date}. Đang chờ quản lý duyệt công (${workedMinutes} phút).`,
          type: 'shift',
          link: '/employer/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to notify employer of checkout:', notifErr.message);
    }

    res.json({
      verified: isVerified,
      verificationStatus: evaluation.verificationStatus,
      reasonCode: evaluation.reasonCode,
      distanceMeters: evaluation.distanceMeters,
      workedMinutes,
      shift: { ...shift.toObject(), id: shift._id },
    });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/approve (Duyệt công)
router.post('/:id/approve', async (req, res, next) => {
  try {
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
    const result = await markPayrollReady(req.params.id, req.user);
    res.json({ message: 'Đã chuyển ca làm sang trạng thái sẵn sàng tính lương.', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/pay (Chi trả lương)
router.post('/:id/pay', async (req, res, next) => {
  try {
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
    const { adjustedMinutes, workedMinutes, reason } = req.body;
    const mins = adjustedMinutes !== undefined ? adjustedMinutes : workedMinutes;
    const result = await adjustWorkedTime(req.params.id, req.user, { adjustedMinutes: mins, reason });
    res.json({ message: 'Đã điều chỉnh thời gian làm việc thành công', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/dispute (Báo đối soát công)
router.post('/:id/dispute', async (req, res, next) => {
  try {
    const { reason, disputeReason } = req.body;
    const result = await disputeShift(req.params.id, req.user, { disputeReason: disputeReason || reason });
    res.json({ message: 'Đã ghi nhận yêu cầu đối soát ca làm.', ...result });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/resolve-dispute (Giải quyết đối soát công)
router.post('/:id/resolve-dispute', async (req, res, next) => {
  try {
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
