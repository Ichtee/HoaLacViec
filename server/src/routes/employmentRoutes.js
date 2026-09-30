import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middlewares/auth.js';
import {
  getEmployments,
  terminateEmployment,
  updateEmployment,
} from '../services/employmentService.js';
import { Employment } from '../models/Employment.js';

const router = express.Router();
router.use(authenticate);

// GET /api/employments (List employees)
router.get('/', async (req, res, next) => {
  try {
    const { status, search, employerId, employeeId } = req.query;
    const filter = { status, search };

    if (req.user.role === 'employer') {
      filter.employerUserId = req.user._id;
    } else if (['student', 'worker', 'freelancer'].includes(req.user.role)) {
      filter.employeeUserId = req.user._id;
    } else if (req.user.role === 'admin') {
      if (employerId) filter.employerUserId = employerId;
      if (employeeId) filter.employeeUserId = employeeId;
    } else if (!['employer', 'admin'].includes(req.user.role)) {
      // Unknown role — deny completely
      return res.status(403).json({ error: 'Không có quyền truy cập.', code: 'FORBIDDEN' });
    }

    const employments = await getEmployments(filter);
    res.json(employments);
  } catch (err) {
    next(err);
  }
});

// GET /api/employments/:id (Get single employment detail)
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã nhân viên không hợp lệ.', code: 'INVALID_ID' });
    }

    const employment = await Employment.findById(req.params.id)
      .populate('employeeUserId', 'name phone email avatar studentProfile')
      .populate('employerUserId', 'name phone email storeName')
      .populate('jobId', 'title storeName address location salaryAmount salaryUnit')
      .populate('sourceApplicationId')
      .lean();

    if (!employment) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên.', code: 'NOT_FOUND' });
    }

    // Permission check
    if (req.user.role !== 'admin') {
      const isEmployee = employment.employeeUserId?._id?.toString() === req.user._id.toString();
      const isEmployer = employment.employerUserId?._id?.toString() === req.user._id.toString();
      if (!isEmployee && !isEmployer) {
        return res.status(403).json({ error: 'Bạn không có quyền xem thông tin nhân viên này.', code: 'FORBIDDEN' });
      }
    }

    res.json({ ...employment, id: employment._id });
  } catch (err) {
    next(err);
  }
});

// PUT /api/employments/:id (Update role/wage/status)
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã nhân viên không hợp lệ.', code: 'INVALID_ID' });
    }

    const updated = await updateEmployment(req.params.id, req.user._id, req.body);
    res.json({ message: 'Cập nhật thông tin nhân viên thành công', employment: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/employments/:id/terminate (End employment / Cho thôi việc - soft transition)
router.post('/:id/terminate', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã nhân viên không hợp lệ.', code: 'INVALID_ID' });
    }

    const { reasonCode, note, futureShiftAction } = req.body;
    const result = await terminateEmployment(req.params.id, req.user._id, {
      reasonCode,
      note,
      futureShiftAction: futureShiftAction || 'cancel',
    });

    res.json({
      message: 'Đã hoàn tất kết thúc làm việc đối với nhân viên thành công.',
      employment: result.employment,
      cancelledShiftsCount: result.cancelledShiftsCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
