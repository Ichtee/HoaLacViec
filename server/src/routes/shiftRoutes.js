import express from 'express';
import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';
import { calculateHaversineDistanceMeters } from '../utils/haversine.js';

const router = express.Router();

router.use(authenticate);

// Default coordinates for Hòa Lạc High-Tech Park (if job has no coordinates set)
const DEFAULT_HOALAC_COORDS = { lat: 21.0128, lng: 105.5255 };

// GET /api/shifts
router.get('/', async (req, res) => {
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

      const empOr = [
        { employerUserId: req.user._id },
        { employerId: { $in: employerIds } },
      ];
      if (profile?.storeName) {
        empOr.push({ storeName: { $regex: new RegExp(`^${profile.storeName}$`, 'i') } });
      }
      filter.$or = empOr;
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
      // Map 'completed' status to 'approved' for UI consistency
      status: s.status === 'completed' ? 'approved' : s.status,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/:id
router.get('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate('jobId', 'title storeName address location')
      .populate('studentUserId', 'name email phone avatar')
      .lean();

    if (!shift) {
      return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });
    }

    // Role access check
    if (req.user.role !== 'admin') {
      const isStudent =
        (shift.studentUserId && shift.studentUserId._id?.toString() === req.user._id.toString()) ||
        (shift.studentId && shift.studentId.toString() === req.user._id.toString());
      const isEmployer =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isStudent && !isEmployer) {
        return res.status(403).json({ error: 'Bạn không có quyền xem thông tin ca làm việc này.' });
      }
    }

    res.json({ ...shift, id: shift._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts (Phân ca mới - Employer/Admin)
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền phân ca làm việc.' });
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
    if (!assignedStudentId) {
      return res.status(400).json({ error: 'Vui lòng chọn sinh viên nhận ca làm việc.' });
    }
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày, giờ bắt đầu và giờ kết thúc ca làm.' });
    }

    const student = await User.findById(assignedStudentId);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản sinh viên được phân ca.' });
    }

    let jobStoreName = storeName;
    if (!jobStoreName && jobId) {
      const job = await Job.findById(jobId);
      if (job) jobStoreName = job.storeName;
    }
    if (!jobStoreName) {
      const empProfile = await EmployerProfile.findOne({ userId: req.user._id });
      if (empProfile) jobStoreName = empProfile.storeName;
    }

    // Calculate planned hours if not provided
    let calculatedHours = hours ? Number(hours) : 4;
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMinutes > 0) {
        calculatedHours = Number((diffMinutes / 60).toFixed(1));
      }
    } catch {
      // fallback to default
    }

    const newShift = await Shift.create({
      jobId: jobId || null,
      applicationId: applicationId || null,
      storeName: jobStoreName || 'Cửa hàng tuyển dụng',
      employerUserId: req.user._id,
      employerId: req.user._id,
      studentUserId: student._id,
      studentId: student._id,
      studentName: student.name,
      role: role || 'Nhân viên bán ca',
      date,
      startTime,
      endTime,
      hours: calculatedHours,
      wageRate: Number(wageRate) || 25000,
      totalPay: Math.round(calculatedHours * (Number(wageRate) || 25000)),
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

    // Send in-app notification to student
    try {
      await Notification.create({
        userId: student._id,
        title: 'Bạn có lịch phân ca mới! 📅',
        message: `Quán ${jobStoreName || ''} đã xếp bạn vào ca làm ngày ${date} từ ${startTime} đến ${endTime}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Notification error on shift creation:', notifErr.message);
    }

    res.status(201).json(newShift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/checkin (Điểm danh vào ca bằng GPS thực tế)
router.post('/:id/checkin', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    // Only the assigned student or admin can check in
    const isAssigned =
      (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
      (shift.studentId && shift.studentId.toString() === req.user._id.toString());

    if (req.user.role !== 'admin' && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền điểm danh cho ca làm của người khác.' });
    }

    // State machine check
    if (shift.status !== 'scheduled') {
      return res.status(400).json({
        error: `Không thể điểm danh vào ca vì trạng thái hiện tại là "${shift.status}".`,
      });
    }

    const { lat, lng, accuracy } = req.body;
    let distanceMeters = null;
    let isVerified = false;

    // Find reference store coordinates
    let targetCoords = null;
    if (shift.jobId) {
      const job = await Job.findById(shift.jobId);
      if (job?.location?.lat && job?.location?.lng) {
        targetCoords = { lat: job.location.lat, lng: job.location.lng };
      }
    }
    if (!targetCoords) {
      targetCoords = DEFAULT_HOALAC_COORDS;
    }

    if (lat && lng) {
      distanceMeters = calculateHaversineDistanceMeters(lat, lng, targetCoords.lat, targetCoords.lng);
      // Validated radius: 350m (tolerance for GPS drift in student campus)
      isVerified = distanceMeters !== null && distanceMeters <= 350;
    }

    shift.status = 'checked_in';
    shift.attendance = {
      ...shift.attendance,
      checkInAt: new Date(),
      checkInCoords: {
        lat: lat || null,
        lng: lng || null,
        accuracy: accuracy || null,
      },
      checkInDistanceMeters: distanceMeters,
      checkInVerified: isVerified,
      locationVerified: isVerified,
    };

    shift.history.push({
      status: 'checked_in',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: isVerified
        ? `Điểm danh vào ca tại quán (Khoảng cách GPS: ${distanceMeters}m)`
        : `Điểm danh vào ca (Cách địa điểm: ${distanceMeters ? `${distanceMeters}m` : 'chưa có GPS'}, cần NTD duyệt)`,
    });

    await shift.save();

    // Send notification to employer
    try {
      const employerTarget = shift.employerUserId || shift.employerId;
      if (employerTarget) {
        await Notification.create({
          userId: employerTarget,
          title: `Sinh viên ${shift.studentName || ''} đã check-in vào ca`,
          message: `Check-in ca ${shift.startTime} - ${shift.endTime}. Khoảng cách GPS: ${distanceMeters ? `${distanceMeters}m` : 'N/A'}. Trạng thái: ${isVerified ? 'Hợp lệ tại quán' : 'Ngoài phạm vi'}`,
          type: 'shift',
          link: '/employer/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Shift checkin notification error:', notifErr.message);
    }

    res.json({
      message: isVerified
        ? 'Điểm danh vào ca thành công! Tọa độ GPS trùng khớp với quán.'
        : `Đã ghi nhận điểm danh vào ca (Khoảng cách: ${distanceMeters ? `${distanceMeters}m` : 'chưa xác định'}).`,
      shift,
      verified: isVerified,
      distanceMeters,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/checkout (Điểm danh ra ca - Tính giờ & tiền công thực tế)
router.post('/:id/checkout', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    const isAssigned =
      (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
      (shift.studentId && shift.studentId.toString() === req.user._id.toString());

    if (req.user.role !== 'admin' && !isAssigned) {
      return res.status(403).json({ error: 'Bạn không có quyền điểm danh cho ca làm của người khác.' });
    }

    if (shift.status !== 'checked_in') {
      return res.status(400).json({
        error: 'Chỉ có thể check-out sau khi đã check-in vào ca làm việc.',
      });
    }

    const { lat, lng, accuracy } = req.body;
    let distanceMeters = null;
    let isVerified = false;

    let targetCoords = null;
    if (shift.jobId) {
      const job = await Job.findById(shift.jobId);
      if (job?.location?.lat && job?.location?.lng) {
        targetCoords = { lat: job.location.lat, lng: job.location.lng };
      }
    }
    if (!targetCoords) {
      targetCoords = DEFAULT_HOALAC_COORDS;
    }

    if (lat && lng) {
      distanceMeters = calculateHaversineDistanceMeters(lat, lng, targetCoords.lat, targetCoords.lng);
      isVerified = distanceMeters !== null && distanceMeters <= 350;
    }

    const checkInTime = shift.attendance?.checkInAt || new Date();
    const checkOutTime = new Date();
    const workedMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60)));
    const workedHours = Number((workedMinutes / 60).toFixed(2));
    const calculatedPay = Math.round((workedMinutes / 60) * (shift.wageRate || 25000));

    shift.status = 'pending_approval'; // Waiting for employer to review and approve pay
    shift.workedMinutes = workedMinutes;
    shift.totalPay = calculatedPay;

    shift.attendance = {
      ...shift.attendance,
      checkOutAt: checkOutTime,
      checkOutCoords: {
        lat: lat || null,
        lng: lng || null,
        accuracy: accuracy || null,
      },
      checkOutDistanceMeters: distanceMeters,
      checkOutVerified: isVerified,
    };

    shift.history.push({
      status: 'pending_approval',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Check-out ra ca: làm việc ${workedMinutes} phút (~${workedHours} giờ). Đang chờ quản lý duyệt công.`,
    });

    await shift.save();

    // Send notification to employer
    try {
      const employerTarget = shift.employerUserId || shift.employerId;
      if (employerTarget) {
        await Notification.create({
          userId: employerTarget,
          title: `Sinh viên ${shift.studentName || ''} đã check-out ra ca`,
          message: `Đã hoàn thành ca làm ngày ${shift.date} (${workedMinutes} phút). Vui lòng xác nhận duyệt công.`,
          type: 'shift',
          link: '/employer/shifts',
        });
      }
    } catch (notifErr) {
      console.warn('Shift checkout notification error:', notifErr.message);
    }

    res.json({
      message: 'Check-out ra ca thành công! Ca làm đã được gửi cho nhà tuyển dụng để duyệt công.',
      shift,
      workedMinutes,
      totalPay: calculatedPay,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/approve (NTD duyệt chốt công ca làm)
router.post('/:id/approve', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());

      const isOwner =
        (shift.employerUserId && allowedIds.includes(shift.employerUserId.toString())) ||
        (shift.employerId && allowedIds.includes(shift.employerId.toString()));

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền duyệt công cho ca làm việc này.' });
      }
    }

    shift.status = 'approved';
    if (!shift.attendance) shift.attendance = {};
    if (!shift.attendance.checkOutAt) shift.attendance.checkOutAt = new Date();

    // Ensure totalPay is calculated
    if (!shift.totalPay || shift.totalPay === 0) {
      const hours = shift.hours || 4;
      shift.totalPay = Math.round(hours * (shift.wageRate || 25000));
    }

    shift.history.push({
      status: 'approved',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Nhà tuyển dụng đã xác nhận duyệt công và tiền lương.',
    });

    await shift.save();

    // Send notification to student
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/dispute (NTD báo cáo bất thường về ca làm)
router.post('/:id/dispute', async (req, res) => {
  try {
    const { reason } = req.body;
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());

      const isOwner =
        (shift.employerUserId && allowedIds.includes(shift.employerUserId.toString())) ||
        (shift.employerId && allowedIds.includes(shift.employerId.toString()));

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền báo cáo ca làm việc này.' });
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shifts/:id (Cập nhật thông tin ca)
router.put('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());

      const isOwner =
        (shift.employerUserId && allowedIds.includes(shift.employerUserId.toString())) ||
        (shift.employerId && allowedIds.includes(shift.employerId.toString()));

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa ca làm việc này.' });
      }
    }

    const updated = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());

      const isOwner =
        (shift.employerUserId && allowedIds.includes(shift.employerUserId.toString())) ||
        (shift.employerId && allowedIds.includes(shift.employerId.toString()));

      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa ca làm việc này.' });
      }
    }

    await Shift.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã hủy ca làm việc' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
