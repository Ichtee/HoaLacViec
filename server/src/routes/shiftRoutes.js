import express from 'express';
import { Shift } from '../models/Shift.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/shifts
router.get('/', async (req, res) => {
  try {
    const { studentId, employerId, storeId, storeName, status, date } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      filter.studentId = req.user._id;
    } else if (req.user.role === 'employer') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const empOr = [{ employerId: req.user._id }];
      if (profile) {
        empOr.push({ employerId: profile._id });
        if (profile.storeName) {
          empOr.push({ storeName: { $regex: new RegExp(`^${profile.storeName}$`, 'i') } });
        }
      }
      filter.$or = empOr;
    } else if (req.user.role === 'admin') {
      if (studentId) filter.studentId = studentId;
      const emp = employerId || storeId;
      if (emp || storeName) {
        const orList = [];
        if (emp) orList.push({ employerId: emp });
        if (storeName) orList.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
        if (orList.length > 0) filter.$or = orList;
      }
    }

    if (status) filter.status = status;
    if (date) filter.date = date;

    const shifts = await Shift.find(filter).sort({ date: 1, startTime: 1 });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts (Phân ca mới - Employer/Admin)
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền tạo ca làm.' });
    }

    const shiftData = { ...req.body };
    if (req.user.role === 'employer') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      shiftData.employerId = profile ? profile._id : req.user._id;
      if (profile?.storeName && !shiftData.storeName) {
        shiftData.storeName = profile.storeName;
      }
    }

    const shift = await Shift.create(shiftData);
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/approve (NTD duyệt công ca làm)
router.post('/:id/approve', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());
      if (shift.employerId && !allowedIds.includes(shift.employerId.toString())) {
        return res.status(403).json({ error: 'Bạn không có quyền duyệt ca làm này.' });
      }
    }

    shift.status = 'completed';
    if (!shift.attendance) shift.attendance = {};
    if (!shift.attendance.checkOutAt) shift.attendance.checkOutAt = new Date();
    await shift.save();

    res.json({ message: 'Đã xác nhận hoàn thành công cho sinh viên', shift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shifts/:id
router.put('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm.' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedIds = [req.user._id.toString()];
      if (profile) allowedIds.push(profile._id.toString());
      if (shift.employerId && !allowedIds.includes(shift.employerId.toString())) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa ca làm này.' });
      }
    }

    const updated = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/checkin (Điểm danh vào ca)
router.post('/:id/checkin', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm.' });

    if (req.user.role !== 'admin' && shift.studentId && shift.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không phải là người được phân ca này.' });
    }

    shift.status = 'checked_in';
    shift.attendance = {
      ...shift.attendance,
      checkInAt: new Date(),
      locationVerified: true,
    };
    await shift.save();

    res.json({ message: 'Điểm danh vào ca thành công', shift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/checkout (Điểm danh ra ca)
router.post('/:id/checkout', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm.' });

    if (req.user.role !== 'admin' && shift.studentId && shift.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không phải là người được phân ca này.' });
    }

    shift.status = 'completed';
    shift.attendance = {
      ...shift.attendance,
      checkOutAt: new Date(),
    };
    await shift.save();

    res.json({ message: 'Điểm danh ra ca thành công', shift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

