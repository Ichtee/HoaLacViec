import express from 'express';
import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';
import { evaluateAttendanceGPS, clampRadius, evaluateCheckinWindow } from '../utils/geoHelper.js';
import {
  createShift,
  publishShifts,
  acknowledgeShift,
  rescheduleShift,
  cancelShift,
  approveAttendance,
  markPayrollReady,
  markPaid,
  adjustWorkedTime,
} from '../services/schedulingService.js';

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
    const { studentId, employerId, storeId, storeName, status, date, startDate, endDate } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      filter.$or = [
        { studentUserId: req.user._id },
        { studentId: req.user._id },
      ];
      // Student only sees published, acknowledged, or active shifts (hide draft shifts)
      filter.status = { $ne: 'draft' };
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

    res.json({ ...shift, id: shift._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts (Create shift with authoritative eligibility & conflict checks)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền phân ca làm việc.', code: 'FORBIDDEN' });
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
      storeName,
    } = req.body;

    const assignedStudentId = studentUserId || studentId;
    if (!assignedStudentId || !mongoose.Types.ObjectId.isValid(assignedStudentId)) {
      return res.status(400).json({ error: 'Vui lòng chọn nhân viên nhận ca hợp lệ.', code: 'INVALID_STUDENT' });
    }
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày, giờ bắt đầu và giờ kết thúc ca làm.', code: 'MISSING_SCHEDULE' });
    }

    const newShift = await createShift(
      {
        studentUserId: assignedStudentId,
        jobId,
        date,
        startTime,
        endTime,
        role,
        wageRate,
        isDraft: Boolean(isDraft),
        storeName,
      },
      req.user._id
    );

    res.status(201).json({
      message: isDraft ? 'Đã tạo ca làm ở trạng thái nháp.' : 'Phân ca làm việc và công bố lịch thành công!',
      shift: { ...newShift.toObject(), id: newShift._id },
    });
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

    const { shiftIds } = req.body;
    const result = await publishShifts({ shiftIds, employerUserId: req.user._id });

    res.json({
      message: `Đã công bố ${result.publishedCount} ca làm việc thành công!`,
      publishedCount: result.publishedCount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/acknowledge (Student acknowledges shift schedule)
router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const shift = await acknowledgeShift(req.params.id, req.user._id);
    res.json({ message: 'Đã xác nhận xem lịch ca làm việc thành công.', shift });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shifts/:id/reschedule (Reschedule shift with conflict validation)
router.put('/:id/reschedule', async (req, res, next) => {
  try {
    const shift = await rescheduleShift(req.params.id, req.body, req.user._id);
    res.json({ message: 'Đã đổi lịch ca làm thành công.', shift });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/:id/cancel (Cancel shift - soft cancellation)
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const shift = await cancelShift(req.params.id, req.user._id, reason);
    res.json({ message: 'Đã hủy ca làm việc thành công.', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/checkin (Check-in window: -30m to +60m from startTime, Asia/Ho_Chi_Minh)
router.post('/:id/checkin', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('jobId');
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    // Only assigned student or admin can check in
    const isAssigned =
      (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
      (shift.studentId && shift.studentId.toString() === req.user._id.toString());

    if (req.user.role !== 'admin' && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền điểm danh cho ca làm của người khác.', code: 'FORBIDDEN' });
    }

    const checkinValidStatuses = ['published', 'acknowledged', 'scheduled'];
    if (!checkinValidStatuses.includes(shift.status)) {
      return res.status(400).json({
        error: `Không thể điểm danh vào ca vì ca làm đang ở trạng thái "${shift.status}". Chỉ ca đã công bố hoặc xác nhận mới có thể check-in.`,
        code: 'INVALID_STATUS',
      });
    }

    // Time window validation: [-30min, +60min] relative to shift startTime (Asia/Ho_Chi_Minh: +07:00)
    const windowCheck = evaluateCheckinWindow(shift.date, shift.startTime);
    if (!windowCheck.allowed && windowCheck.code !== 'INVALID_DATETIME') {
      return res.status(400).json({
        error: windowCheck.error,
        code: windowCheck.code,
      });
    }

    const { lat, lng, accuracy, timestamp, isManual, manualReason } = req.body;

    let employerRadius = 150;
    try {
      const employerTarget = shift.employerUserId || shift.employerId;
      if (employerTarget) {
        const empProfile = await EmployerProfile.findOne({
          $or: [{ userId: employerTarget }, { _id: employerTarget }]
        }).lean();
        if (empProfile?.checkinRadius) {
          employerRadius = clampRadius(empProfile.checkinRadius);
        }
      }
    } catch (err) {
      console.warn('Could not read employer checkinRadius:', err.message);
    }

    const job = shift.jobId;
    const evaluation = evaluateAttendanceGPS({
      lat,
      lng,
      accuracy,
      timestamp,
      jobLocation: job?.location,
      jobLocationStatus: job?.locationStatus,
      checkinRadius: employerRadius,
      isManual: Boolean(isManual),
      manualReason: manualReason || '',
    });

    if (evaluation.status === 'rejected') {
      return res.status(400).json({
        error: evaluation.message,
        reasonCode: evaluation.reasonCode,
      });
    }

    shift.status = 'checked_in';
    if (!shift.attendance) shift.attendance = {};
    shift.attendance.checkInAt = new Date();
    shift.attendance.checkInCoords = {
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    shift.attendance.checkInDistanceMeters = evaluation.distanceMeters;
    shift.attendance.checkInVerified = evaluation.verified;
    shift.attendance.checkInVerificationStatus = evaluation.status;
    shift.attendance.checkInReasonCode = evaluation.reasonCode;
    shift.attendance.checkInTargetCoords = evaluation.targetCoords;
    shift.attendance.checkInConfiguredRadius = evaluation.configuredRadius;
    shift.attendance.checkInManualReason = manualReason || null;
    shift.attendance.locationVerified = evaluation.verified;

    shift.history.push({
      status: 'checked_in',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: evaluation.verified
        ? `Điểm danh vào ca tại quán (Khoảng cách GPS: ${Math.round(evaluation.distanceMeters)}m, bán kính ${evaluation.configuredRadius}m)`
        : `Điểm danh vào ca (${evaluation.message})`,
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
      console.warn('Shift checkin notification error:', notifErr.message);
    }

    res.json({
      message: evaluation.message,
      shift,
      verified: evaluation.verified,
      verificationStatus: evaluation.status,
      reasonCode: evaluation.reasonCode,
      distanceMeters: evaluation.distanceMeters,
      configuredRadius: evaluation.configuredRadius,
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

    const isAssigned =
      (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
      (shift.studentId && shift.studentId.toString() === req.user._id.toString());

    if (req.user.role !== 'admin' && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền điểm danh cho ca làm của người khác.', code: 'FORBIDDEN' });
    }

    if (shift.status !== 'checked_in') {
      return res.status(400).json({
        error: 'Chỉ có thể check-out sau khi đã check-in vào ca làm việc.',
        code: 'INVALID_STATUS',
      });
    }

    const { lat, lng, accuracy, timestamp, isManual, manualReason } = req.body;

    let employerRadius = 150;
    try {
      const employerTarget = shift.employerUserId || shift.employerId;
      if (employerTarget) {
        const empProfile = await EmployerProfile.findOne({
          $or: [{ userId: employerTarget }, { _id: employerTarget }]
        }).lean();
        if (empProfile?.checkinRadius) {
          employerRadius = clampRadius(empProfile.checkinRadius);
        }
      }
    } catch (err) {
      console.warn('Could not read employer checkinRadius:', err.message);
    }

    const job = shift.jobId;
    const evaluation = evaluateAttendanceGPS({
      lat,
      lng,
      accuracy,
      timestamp,
      jobLocation: job?.location,
      jobLocationStatus: job?.locationStatus,
      checkinRadius: employerRadius,
      isManual: Boolean(isManual),
      manualReason: manualReason || '',
    });

    if (evaluation.status === 'rejected') {
      return res.status(400).json({
        error: evaluation.message,
        reasonCode: evaluation.reasonCode,
      });
    }

    const checkInTime = shift.attendance?.checkInAt || new Date();
    const checkOutTime = new Date();
    const workedMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60)));
    const calculatedPay = Math.round((workedMinutes / 60) * (shift.wageRate || 25000));

    shift.status = 'completed_pending_review';
    shift.workedMinutes = workedMinutes;
    shift.totalPay = calculatedPay;

    if (!shift.attendance) shift.attendance = {};
    shift.attendance.checkOutAt = checkOutTime;
    shift.attendance.checkOutCoords = {
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    shift.attendance.checkOutDistanceMeters = evaluation.distanceMeters;
    shift.attendance.checkOutVerified = evaluation.verified;
    shift.attendance.checkOutVerificationStatus = evaluation.status;
    shift.attendance.checkOutReasonCode = evaluation.reasonCode;
    shift.attendance.checkOutTargetCoords = evaluation.targetCoords;
    shift.attendance.checkOutConfiguredRadius = evaluation.configuredRadius;
    shift.attendance.checkOutManualReason = manualReason || null;

    shift.history.push({
      status: 'completed_pending_review',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Check-out ra ca: làm việc ${workedMinutes} phút. ${evaluation.verified ? 'Xác thực GPS hợp lệ tại quán.' : `Chờ duyệt (${evaluation.reasonCode})`}`,
    });

    await shift.save();

    // Notify employer
    try {
      const employerTarget = await resolveEmployerUserId(shift);
      if (employerTarget) {
        await Notification.create({
          userId: employerTarget,
          title: `Sinh viên ${shift.studentName || ''} đã check-out ra ca`,
          message: `Ca ngày ${shift.date} (${shift.startTime} - ${shift.endTime}) đã hoàn thành (${workedMinutes} phút). Vui lòng kiểm tra và duyệt công.`,
          type: 'shift',
          link: '/employer/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Shift checkout notification error:', notifErr.message);
    }

    res.json({
      message: evaluation.message || 'Check-out ra ca thành công! Ca làm đã được gửi cho nhà tuyển dụng để duyệt công.',
      shift,
      verified: evaluation.verified,
      verificationStatus: evaluation.status,
      reasonCode: evaluation.reasonCode,
      distanceMeters: evaluation.distanceMeters,
      configuredRadius: evaluation.configuredRadius,
      workedMinutes,
      totalPay: calculatedPay,
    });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/approve (Duyệt công)
router.post('/:id/approve', async (req, res, next) => {
  try {
    const shift = await approveAttendance(req.params.id, req.user._id);
    res.json({ message: 'Đã xác nhận duyệt công làm việc thành công', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/payroll-ready (Sẵn sàng tính lương)
router.post('/:id/payroll-ready', async (req, res, next) => {
  try {
    const shift = await markPayrollReady(req.params.id, req.user._id);
    res.json({ message: 'Đã chuyển ca làm sang trạng thái sẵn sàng tính lương.', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/pay (Chi trả lương)
router.post('/:id/pay', async (req, res, next) => {
  try {
    const shift = await markPaid(req.params.id, req.user._id);
    res.json({ message: 'Đã xác nhận hoàn tất chi trả lương cho ca làm.', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: PUT /api/shifts/:id/adjust (Điều chỉnh giờ làm có audit)
router.put('/:id/adjust', async (req, res, next) => {
  try {
    const { workedMinutes, reason } = req.body;
    const shift = await adjustWorkedTime(req.params.id, req.user._id, { workedMinutes, reason });
    res.json({ message: 'Đã điều chỉnh thời gian làm việc thành công', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/dispute (Dispute attendance)
router.post('/:id/dispute', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    shift.status = 'disputed';
    shift.disputeReason = reason || 'Có tranh chấp về dữ liệu chấm công hoặc ca làm';
    shift.history.push({
      status: 'disputed',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Báo cáo tranh chấp ca: ${reason || 'Không rõ'}`,
    });
    await shift.save();

    res.json({ message: 'Đã ghi nhận yêu cầu đối soát ca làm.', shift });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shifts/:id (Soft cancel only if published; allow delete only if draft)
router.delete('/:id', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (shift.status === 'draft') {
      await Shift.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Đã xóa ca nháp thành công', id: req.params.id });
    }

    // Published shifts must be cancelled, not hard deleted
    const cancelled = await cancelShift(req.params.id, req.user._id, req.body?.reason || 'Hủy ca đã công bố');
    res.json({ message: 'Ca làm đã được chuyển sang trạng thái hủy (không xóa lịch sử).', shift: cancelled });
  } catch (err) {
    next(err);
  }
});

export default router;
