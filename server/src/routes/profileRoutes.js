import express from 'express';
import { User } from '../models/User.js';
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

// GET /api/profiles/student-verification/me (Kiểm tra trạng thái xác minh sinh viên)
router.get('/student-verification/me', authenticate, async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id });
    res.json({
      status: profile?.verificationStatus || 'draft',
      verificationStatus: profile?.verificationStatus || 'draft',
      verified: profile?.verified || false,
      verifiedAt: profile?.verifiedAt || null,
      studentCardPhoto: profile?.studentCardPhoto || '',
      studentCode: profile?.studentCode || '',
      university: profile?.university || '',
      major: profile?.major || '',
      transport: profile?.transport || 'xe_may',
      rejectionReason: profile?.rejectionReason || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profiles/student-verification/submit (Sinh viên nộp thẻ SV để Admin duyệt)
router.post('/student-verification/submit', authenticate, async (req, res) => {
  try {
    const { studentCardPhoto, university, studentCode, major, transport, bio } = req.body;

    if (!studentCardPhoto) {
      return res.status(400).json({ error: 'Vui lòng tải lên ảnh chụp thẻ sinh viên của bạn.' });
    }

    if (!studentCode || !studentCode.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập mã số sinh viên của bạn.' });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        studentCardPhoto,
        university: (university || 'Đại học FPT Hòa Lạc').trim(),
        studentCode: studentCode.trim().toUpperCase(),
        major: (major || 'Kỹ thuật phần mềm').trim(),
        transport: transport || 'xe_may',
        bio: (bio || '').trim(),
        verified: false,
        verificationStatus: 'pending',
        rejectionReason: '',
        reviewedBy: null,
        reviewedAt: null,
        profileComplete: true,
      },
      { new: true, upsert: true }
    );

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        role: 'student',
        status: 'pending',
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Hồ sơ thẻ sinh viên đã được gửi thành công và đang chờ Ban Quản Trị xét duyệt.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        profileId: profile._id,
        profile,
      },
      profile,
    });
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

// POST /api/profiles/employer-verification/submit (NTD nộp hồ sơ xác minh để Admin duyệt)
router.post('/employer-verification/submit', authenticate, async (req, res) => {
  try {
    // Cho phép người dùng ở trạng thái pending, employer hoặc admin nộp hồ sơ
    const allowedRoles = ['pending', 'employer', 'admin'];
    if (!allowedRoles.includes(req.user.role) && req.user.status !== 'pending') {
      return res.status(403).json({ error: 'Tài khoản không đủ quyền để nộp hồ sơ nhà tuyển dụng.' });
    }

    const {
      storeName,
      legalName,
      taxCode,
      idCardNumber,
      businessAddress,
      contactPhone,
      documents,
      storeType,
      description,
    } = req.body;

    if (!storeName || !legalName || !businessAddress || !contactPhone) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ tên cơ sở, người đại diện, địa chỉ và số điện thoại liên hệ.' });
    }

    // Upsert hồ sơ cửa hàng
    await EmployerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        storeName: storeName.trim(),
        storeType: (storeType || 'Cửa hàng').trim(),
        address: businessAddress.trim(),
        contactPhone: contactPhone.trim(),
        contactName: legalName.trim(),
        description: (description || '').trim(),
        verified: false,
      },
      { new: true, upsert: true }
    );

    // Cập nhật trạng thái người dùng thành employer, pending
    await User.findByIdAndUpdate(req.user._id, {
      role: 'employer',
      status: 'pending',
    });

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

    res.json({
      message: 'Hồ sơ xác minh đã được gửi thành công và đang chờ Ban Quản Trị xét duyệt.',
      verification,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

