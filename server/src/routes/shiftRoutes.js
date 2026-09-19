import express from 'express';
import { Shift } from '../models/Shift.js';

const router = express.Router();

// GET /api/shifts
router.get('/', async (req, res) => {
  try {
    const { studentId, employerId, storeId, storeName, status, date } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;
    const emp = employerId || storeId;
    if (emp || storeName) {
      const orList = [];
      if (emp) orList.push({ employerId: emp });
      if (storeName) orList.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
      if (orList.length > 0) filter.$or = orList;
    }
    if (status) filter.status = status;
    if (date) filter.date = date;

    const shifts = await Shift.find(filter).sort({ date: 1, startTime: 1 });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts (Phân ca mới)
router.post('/', async (req, res) => {
  try {
    const shift = await Shift.create(req.body);
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/approve (NTD duyệt công ca làm)
router.post('/:id/approve', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm' });

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
    const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/:id/checkin (Điểm danh vào ca)
router.post('/:id/checkin', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm' });

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
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm' });

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

