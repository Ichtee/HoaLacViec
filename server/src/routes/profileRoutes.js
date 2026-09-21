import express from 'express';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';
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

// GET /api/profiles/employer-verification/me (Kiểm tra trạng thái xác minh của NTD hiện tại)
router.get('/employer-verification/me', authenticate, async (req, res) => {
  try {
    const verification = await EmployerVerification.findOne({ employerUserId: req.user._id });
    res.json(verification || { status: 'draft' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profiles/employer-verification/submit (NTD nộp hồ sơ xác minh)
router.post('/employer-verification/submit', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ tài khoản nhà tuyển dụng mới có thể nộp hồ sơ xác minh.' });
    }

    const {
      storeName,
      legalName,
      taxCode,
      idCardNumber,
      businessAddress,
      contactPhone,
      documents,
    } = req.body;

    if (!storeName || !legalName || !businessAddress || !contactPhone) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ tên cơ sở, người đại diện, địa chỉ và số điện thoại liên hệ.' });
    }

    const verification = await EmployerVerification.findOneAndUpdate(
      { employerUserId: req.user._id },
      {
        employerUserId: req.user._id,
        storeName: storeName.trim(),
        legalName: legalName.trim(),
        taxCode: (taxCode || '').trim(),
        idCardNumber: (idCardNumber || '').trim(),
        businessAddress: businessAddress.trim(),
        contactPhone: contactPhone.trim(),
        documents: Array.isArray(documents) ? documents : [],
        status: 'pending',
        rejectionReason: '',
        reviewedBy: null,
        reviewedAt: null,
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Hồ sơ xác minh đã được gửi thành công và đang chờ xét duyệt.', verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

