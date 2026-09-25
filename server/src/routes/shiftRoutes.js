import express from 'express';
import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { Notification } from '../models/Notification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';
import { evaluateAttendanceGPS, clampRadius, evaluateCheckinWindow } from '../utils/geoHelper.js';

const router = express.Router();

router.use(authenticate);

// GET /api/shifts
router.get('/', async (req, res, next) => {
  try {
    const { studentId, employerId, storeId, storeName, status, date } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      filter.$or = [
        { studentUserId: req.user._id },
        { studentId: req.user._id },
      ];
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

    if (status) filter.status = status;
    if (date) filter.date = date;

    const shifts = await Shift.find(filter)
      .populate('jobId', 'title storeName address location')
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

// POST /api/shifts (Create shift: Employer owner of job only, student must have hired application)
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền phân ca làm việc.', code: 'FORBIDDEN' });
    }

    const {
      studentUserId,
      studentId,
      jobId,
      applicationId,
      date,
      startTime,
      endTime,
      role,
      wageRate,
      hours,
      storeName,
    } = req.body;

    const assignedStudentId = studentUserId || studentId;
    if (!assignedStudentId || !mongoose.Types.ObjectId.isValid(assignedStudentId)) {
      return res.status(400).json({ error: 'Vui lòng chọn sinh viên nhận ca làm việc hợp lệ.', code: 'INVALID_STUDENT' });
    }
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Vui lòng chọn công việc phân ca hợp lệ.', code: 'INVALID_JOB' });
    }
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày, giờ bắt đầu và giờ kết thúc ca làm.', code: 'MISSING_SCHEDULE' });
    }

    // Verify Job existence and ownership
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });
    }

    if (req.user.role !== 'admin') {
      const isJobOwner = job.employerUserId && job.employerUserId.toString() === req.user._id.toString();
      if (!isJobOwner) {
        return res.status(403).json({
          error: 'Bạn chỉ có thể tạo ca làm cho tin tuyển dụng do chính mình quản lý.',
          code: 'FORBIDDEN',
        });
      }
    }

    // Verify student account
    const student = await User.findById(assignedStudentId);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản sinh viên được phân ca.', code: 'STUDENT_NOT_FOUND' });
    }

    // Verify that student has a HIRED application for this job
    if (req.user.role !== 'admin') {
      const hiredApp = await Application.findOne({
        jobId: job._id,
        studentId: student._id,
        status: { $in: ['hired', 'accepted', 'approved'] },
      });

      if (!hiredApp) {
        return res.status(400).json({
          error: 'Sinh viên phải có hồ sơ ứng tuyển ở trạng thái trúng tuyển (hired) cho công việc này mới có thể được xếp ca.',
          code: 'STUDENT_NOT_HIRED',
        });
      }
    }

    // Calculate planned hours
    let calculatedHours = hours ? Number(hours) : 4;
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMinutes > 0) {
        calculatedHours = Number((diffMinutes / 60).toFixed(1));
      }
    } catch {
      // fallback
    }

    const effectiveRate = Number(wageRate) || job.salaryAmount || 25000;

    const newShift = await Shift.create({
      jobId: job._id,
      applicationId: applicationId || null,
      storeName: storeName || job.storeName || 'Cửa hàng tuyển dụng',
      employerUserId: req.user._id,
      employerId: req.user._id,
      studentUserId: student._id,
      studentId: student._id,
      studentName: student.name,
      role: role || job.title || 'Nhân viên bán ca',
      date,
      startTime,
      endTime,
      hours: calculatedHours,
      wageRate: effectiveRate,
      totalPay: Math.round(calculatedHours * effectiveRate),
      status: 'scheduled',
      history: [
        {
          status: 'scheduled',
          changedAt: new Date(),
          changedBy: req.user._id,
          note: `Phân ca làm ngày ${date} (${startTime} - ${endTime})`,
        },
      ],
    });

    // Notify student
    try {
      await Notification.create({
        userId: student._id,
        title: 'Bạn có lịch phân ca mới! 📅',
        message: `Quán ${newShift.storeName} đã xếp bạn vào ca làm ngày ${date} từ ${startTime} đến ${endTime}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Notification error on shift creation:', notifErr.message);
    }

    res.status(201).json(newShift);
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

    if (shift.status !== 'scheduled') {
      return res.status(400).json({
        error: `Không thể điểm danh vào ca vì ca làm đang ở trạng thái "${shift.status}".`,
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
    shift.attendance = {
      ...shift.attendance,
      checkInAt: new Date(),
      checkInCoords: {
        lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
        lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
        accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
      checkInDistanceMeters: evaluation.distanceMeters,
      checkInVerified: evaluation.verified,
      checkInVerificationStatus: evaluation.status,
      checkInReasonCode: evaluation.reasonCode,
      checkInTargetCoords: evaluation.targetCoords,
      checkInConfiguredRadius: evaluation.configuredRadius,
      checkInManualReason: manualReason || null,
      locationVerified: evaluation.verified,
    };

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
      const employerTarget = shift.employerUserId || shift.employerId;
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

    shift.status = 'pending_approval';
    shift.workedMinutes = workedMinutes;
    shift.totalPay = calculatedPay;

    shift.attendance = {
      ...shift.attendance,
      checkOutAt: checkOutTime,
      checkOutCoords: {
        lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
        lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
        accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
      checkOutDistanceMeters: evaluation.distanceMeters,
      checkOutVerified: evaluation.verified,
      checkOutVerificationStatus: evaluation.status,
      checkOutReasonCode: evaluation.reasonCode,
      checkOutTargetCoords: evaluation.targetCoords,
      checkOutConfiguredRadius: evaluation.configuredRadius,
      checkOutManualReason: manualReason || null,
    };

    shift.history.push({
      status: 'pending_approval',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Check-out ra ca: làm việc ${workedMinutes} phút. ${evaluation.verified ? 'Xác thực GPS hợp lệ tại quán.' : `Chờ duyệt (${evaluation.reasonCode})`}`,
    });

    await shift.save();

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

// ACTION: POST /api/shifts/:id/approve (Employer cannot approve before checkout/pending_approval)
router.post('/:id/approve', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền duyệt công cho ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    // Must be in pending_approval or checked_out state
    if (!['pending_approval', 'checked_out'].includes(shift.status)) {
      return res.status(400).json({
        error: 'Không thể duyệt ca làm khi sinh viên chưa check-out hoàn thành ca làm.',
        code: 'CANNOT_APPROVE_UNFINISHED_SHIFT',
      });
    }

    shift.status = 'approved';
    if (!shift.attendance) shift.attendance = {};
    if (!shift.attendance.checkOutAt) shift.attendance.checkOutAt = new Date();

    if (!shift.totalPay || shift.totalPay === 0) {
      const hours = shift.hours || 4;
      shift.totalPay = Math.round(hours * (shift.wageRate || 25000));
    }

    shift.history.push({
      status: 'approved',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Nhà tuyển dụng đã xác nhận duyệt công và chi trả tiền lương.',
    });

    await shift.save();

    // Notify student
    try {
      const studentTarget = shift.studentUserId || shift.studentId;
      if (studentTarget) {
        await Notification.create({
          userId: studentTarget,
          title: 'Ca làm đã được duyệt công! 💰',
          message: `Cửa hàng đã duyệt công cho ca làm ngày ${shift.date}. Thu nhập: ${shift.totalPay.toLocaleString('vi-VN')} VNĐ.`,
          type: 'shift',
          link: '/student/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Shift approval notification error:', notifErr.message);
    }

    res.json({ message: 'Đã xác nhận hoàn thành công cho sinh viên thành công', shift });
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

    if (req.user.role !== 'admin') {
      const isOwner =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền báo cáo ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    shift.status = 'disputed';
    shift.disputeReason = reason || 'Có sai lệch về thời gian hoặc địa điểm chấm công';
    shift.history.push({
      status: 'disputed',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Báo cáo bất thường: ${shift.disputeReason}`,
    });

    await shift.save();

    // Notify student
    try {
      const studentTarget = shift.studentUserId || shift.studentId;
      if (studentTarget) {
        await Notification.create({
          userId: studentTarget,
          title: 'Lưu ý ca làm việc cần đối soát ⚠️',
          message: `Quán ${shift.storeName || ''} đã gửi phản hồi đối soát ca làm ngày ${shift.date}: "${shift.disputeReason}".`,
          type: 'shift',
          link: '/student/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Shift dispute notification error:', notifErr.message);
    }

    res.json({ message: 'Đã chuyển ca làm sang trạng thái cần đối soát', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/reschedule (Reschedule a scheduled shift)
router.post('/:id/reschedule', async (req, res, next) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày và thời gian mới.', code: 'MISSING_FIELDS' });
    }

    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền đổi lịch ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    if (shift.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Chỉ có thể đổi lịch cho ca làm đang ở trạng thái đã xếp lịch (scheduled).',
        code: 'INVALID_STATUS',
      });
    }

    const oldSchedule = `${shift.date} (${shift.startTime} - ${shift.endTime})`;
    shift.date = date;
    shift.startTime = startTime;
    shift.endTime = endTime;

    shift.history.push({
      status: 'scheduled',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Đổi lịch từ ${oldSchedule} sang ${date} (${startTime} - ${endTime}). Lý do: ${reason || 'Điều chỉnh kế hoạch làm việc'}`,
    });

    await shift.save();

    res.json({ message: 'Đã đổi lịch ca làm thành công.', shift });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/shifts/:id/cancel (Cancel scheduled shift)
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền hủy ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    if (['approved', 'completed'].includes(shift.status)) {
      return res.status(400).json({ error: 'Không thể hủy ca làm đã được duyệt hoàn thành.', code: 'INVALID_STATUS' });
    }

    shift.status = 'cancelled';
    shift.history.push({
      status: 'cancelled',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Hủy ca làm. Lý do: ${reason || 'Nhà tuyển dụng hủy lịch'}`,
    });

    await shift.save();

    res.json({ message: 'Đã hủy ca làm việc.', shift });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.', code: 'NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa ca làm việc này.', code: 'FORBIDDEN' });
      }
    }

    if (['checked_in', 'checked_out', 'approved', 'completed'].includes(shift.status)) {
      return res.status(400).json({
        error: 'Không thể xóa ca làm đã diễn ra hoặc đã hoàn thành. Vui lòng sử dụng tính năng hủy ca.',
        code: 'CANNOT_DELETE_ACTIVE_SHIFT',
      });
    }

    await Shift.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa ca làm việc.' });
  } catch (err) {
    next(err);
  }
});

export default router;
