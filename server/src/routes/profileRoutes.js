import express from 'express';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Availability } from '../models/Availability.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/profiles/student/:userId
router.get('/student/:userId', async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.params.userId });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profiles/student/:userId (Chỉ chính chủ sinh viên hoặc admin mới được sửa)
router.put('/student/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa hồ sơ của người khác.' });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.params.userId },
      req.body,
      { new: true, upsert: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles/availability/:userId
router.get('/availability/:userId', async (req, res) => {
  try {
    const avail = await Availability.findOne({ userId: req.params.userId });
    res.json(avail ? avail.slots : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profiles/availability/:userId (Chỉ chính chủ sinh viên hoặc admin)
router.put('/availability/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa lịch rảnh của người khác.' });
    }

    const avail = await Availability.findOneAndUpdate(
      { userId: req.params.userId },
      { slots: req.body },
      { new: true, upsert: true }
    );
    res.json(avail.slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles/employer/:userId
router.get('/employer/:userId', async (req, res) => {
  try {
    const profile = await EmployerProfile.findOne({ userId: req.params.userId });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profiles/employer/:userId (Chỉ chủ nhà tuyển dụng hoặc admin)
router.put('/employer/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa hồ sơ cửa hàng của người khác.' });
    }

    const profile = await EmployerProfile.findOneAndUpdate(
      { userId: req.params.userId },
      req.body,
      { new: true, upsert: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

