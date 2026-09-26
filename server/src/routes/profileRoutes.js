import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';
import { Availability } from '../models/Availability.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.js';
import { isValidCoordinate } from '../utils/geoHelper.js';
import { normalizeLocationInput, LOCATION_STATUSES } from '../utils/locationContract.js';

const router = express.Router();

// Allowlist definitions
const STUDENT_SELF_UPDATE_FIELDS = [
  'university',
  'studentCode',
  'yearOfStudy',
  'major',
  'area',
  'address',
  'addressComponents',
  'bio',
  'skills',
  'transport',
];

const EMPLOYER_SELF_UPDATE_FIELDS = [
  'storeName',
  'storeType',
  'address',
  'addressComponents',
  'area',
  'contactName',
  'contactPhone',
  'description',
  'busRoutes',
];

const ADMIN_ALLOWED_FIELDS_STUDENT = [
  ...STUDENT_SELF_UPDATE_FIELDS,
  'verified',
  'verifiedAt',
  'verificationStatus',
  'rejectionReason',
  'reviewedBy',
  'reviewedAt',
  'reputationScore',
  'reputationCount',
  'profileComplete',
  'locationStatus',
  'locationSource',
];

const ADMIN_ALLOWED_FIELDS_EMPLOYER = [
  ...EMPLOYER_SELF_UPDATE_FIELDS,
  'verified',
  'verifiedAt',
  'checkinRadius',
  'rating',
  'ratingCount',
  'locationStatus',
  'locationSource',
  'locationConfirmedAt',
];

// DTO transformers
function toPublicStudentDTO(profile) {
  if (!profile) return null;
  return {
    _id: profile._id,
    userId: profile.userId,
    university: profile.university,
    yearOfStudy: profile.yearOfStudy,
    major: profile.major,
    area: profile.area,
    bio: profile.bio,
    skills: profile.skills,
    transport: profile.transport,
    reputationScore: profile.reputationScore,
    reputationCount: profile.reputationCount,
    verified: profile.verified,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function toPrivateStudentDTO(profile) {
  if (!profile) return null;
  return {
    _id: profile._id,
    userId: profile.userId,
    university: profile.university,
    studentCode: profile.studentCode,
    yearOfStudy: profile.yearOfStudy,
    major: profile.major,
    area: profile.area,
    address: profile.address,
    addressComponents: profile.addressComponents || null,
    location: profile.location,
    geoPoint: profile.geoPoint || null,
    locationStatus: profile.locationStatus,
    locationSource: profile.locationSource,
    locationConfirmedAt: profile.locationConfirmedAt || null,
    bio: profile.bio,
    skills: profile.skills,
    transport: profile.transport,
    reputationScore: profile.reputationScore,
    reputationCount: profile.reputationCount,
    profileComplete: profile.profileComplete,
    studentCardPhoto: profile.studentCardPhoto,
    verified: profile.verified,
    verifiedAt: profile.verifiedAt,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function toPublicEmployerDTO(profile) {
  if (!profile) return null;
  return {
    _id: profile._id,
    userId: profile.userId,
    storeName: profile.storeName,
    storeType: profile.storeType,
    address: profile.address,
    addressComponents: profile.addressComponents || null,
    area: profile.area,
    location: profile.location,
    geoPoint: profile.geoPoint || null,
    locationStatus: profile.locationStatus,
    contactName: profile.contactName,
    contactPhone: profile.contactPhone,
    description: profile.description,
    verified: profile.verified,
    busRoutes: profile.busRoutes,
    rating: profile.rating,
    ratingCount: profile.ratingCount,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function toPrivateEmployerDTO(profile) {
  if (!profile) return null;
  return {
    ...toPublicEmployerDTO(profile),
    checkinRadius: profile.checkinRadius,
    verifiedAt: profile.verifiedAt,
    locationConfirmedAt: profile.locationConfirmedAt,
    locationSource: profile.locationSource,
  };
}

// GET /api/profiles/student/:userId
router.get('/student/:userId', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    const profile = await StudentProfile.findOne({ userId: req.params.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.', code: 'NOT_FOUND' });
    }

    const isSelfOrAdmin = req.user && (req.user.role === 'admin' || req.user._id.toString() === req.params.userId);
    res.json(isSelfOrAdmin ? toPrivateStudentDTO(profile) : toPublicStudentDTO(profile));
  } catch (err) {
    next(err);
  }
});

// PUT /api/profiles/student/:userId (Protected - self or admin)
router.put('/student/:userId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    const isSelf = req.user._id.toString() === req.params.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        error: 'Bạn không có quyền chỉnh sửa hồ sơ của người khác.',
        code: 'FORBIDDEN',
      });
    }

    const allowedKeys = isAdmin ? ADMIN_ALLOWED_FIELDS_STUDENT : STUDENT_SELF_UPDATE_FIELDS;
    const updateData = {};

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const existingProfile = await StudentProfile.findOne({ userId: req.params.userId });

    // Handle location updates via authoritative contract
    if (
      req.body.location !== undefined ||
      req.body.locationStatus !== undefined ||
      req.body.address !== undefined ||
      req.body.addressComponents !== undefined ||
      req.body.locationSource !== undefined
    ) {
      const normalizedLoc = normalizeLocationInput(req.body, existingProfile, {
        isExplicitConfirm: req.body.locationStatus === LOCATION_STATUSES.CONFIRMED,
      });
      Object.assign(updateData, normalizedLoc);
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(toPrivateStudentDTO(profile));
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/availability/:userId
router.get('/availability/:userId', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    const avail = await Availability.findOne({ userId: req.params.userId });
    res.json(avail ? avail.slots : null);
  } catch (err) {
    next(err);
  }
});

// PUT /api/profiles/availability/:userId (Protected - self or admin)
router.put('/availability/:userId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        error: 'Bạn không có quyền chỉnh sửa lịch rảnh của người khác.',
        code: 'FORBIDDEN',
      });
    }

    const avail = await Availability.findOneAndUpdate(
      { userId: req.params.userId },
      { slots: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(avail.slots);
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/employer/:userId
router.get('/employer/:userId', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    const profile = await EmployerProfile.findOne({ userId: req.params.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ nhà tuyển dụng.', code: 'NOT_FOUND' });
    }

    const isSelfOrAdmin = req.user && (req.user.role === 'admin' || req.user._id.toString() === req.params.userId);
    res.json(isSelfOrAdmin ? toPrivateEmployerDTO(profile) : toPublicEmployerDTO(profile));
  } catch (err) {
    next(err);
  }
});

// PUT /api/profiles/employer/:userId (Protected - self or admin)
router.put('/employer/:userId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.', code: 'INVALID_ID' });
    }

    const isSelf = req.user._id.toString() === req.params.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        error: 'Bạn không có quyền chỉnh sửa hồ sơ của người khác.',
        code: 'FORBIDDEN',
      });
    }

    const allowedKeys = isAdmin ? ADMIN_ALLOWED_FIELDS_EMPLOYER : EMPLOYER_SELF_UPDATE_FIELDS;
    const updateData = {};

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const existingProfile = await EmployerProfile.findOne({ userId: req.params.userId });

    // Handle location updates via authoritative contract
    if (
      req.body.location !== undefined ||
      req.body.locationStatus !== undefined ||
      req.body.address !== undefined ||
      req.body.addressComponents !== undefined ||
      req.body.locationSource !== undefined
    ) {
      const normalizedLoc = normalizeLocationInput(req.body, existingProfile, {
        isExplicitConfirm: req.body.locationStatus === LOCATION_STATUSES.CONFIRMED,
      });
      Object.assign(updateData, normalizedLoc);
    }

    const profile = await EmployerProfile.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(toPrivateEmployerDTO(profile));
  } catch (err) {
    next(err);
  }
});

// POST /api/profiles/employer/me/location/confirm (Explicit location confirmation for current employer)
router.post('/employer/me/location/confirm', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ nhà tuyển dụng.', code: 'PROFILE_NOT_FOUND' });
    }

    const payload = {
      location: req.body.location || profile.location,
      address: req.body.address || profile.address,
      addressComponents: req.body.addressComponents || profile.addressComponents,
      locationSource: req.body.locationSource || profile.locationSource || 'map_pin',
      locationStatus: 'confirmed',
    };

    const normalizedLoc = normalizeLocationInput(payload, profile, { isExplicitConfirm: true });
    if (normalizedLoc.locationStatus !== LOCATION_STATUSES.CONFIRMED || !normalizedLoc.geoPoint) {
      return res.status(400).json({
        error: 'Tọa độ không hợp lệ, không thể xác nhận vị trí.',
        code: 'INVALID_COORDINATES',
      });
    }

    Object.assign(profile, normalizedLoc);
    if (req.body.address) profile.address = req.body.address;
    await profile.save();

    res.json({
      message: 'Vị trí cơ sở đã được xác nhận thành công.',
      profile: toPrivateEmployerDTO(profile),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/student-verification/me (Kiểm tra trạng thái xác minh sinh viên)
router.get('/student-verification/me', authenticate, async (req, res, next) => {
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
    next(err);
  }
});

// POST /api/profiles/student-verification/submit (Sinh viên nộp thẻ SV để Admin duyệt)
router.post('/student-verification/submit', authenticate, async (req, res, next) => {
  try {
    const { studentCardPhoto, university, studentCode, major, transport, bio } = req.body;

    if (!studentCardPhoto) {
      return res.status(400).json({
        error: 'Vui lòng tải lên ảnh chụp thẻ sinh viên của bạn.',
        code: 'MISSING_PHOTO',
      });
    }

    if (!studentCode || !studentCode.trim()) {
      return res.status(400).json({
        error: 'Vui lòng nhập mã số sinh viên của bạn.',
        code: 'MISSING_STUDENT_CODE',
      });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
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
      },
      { new: true, upsert: true, runValidators: true }
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
      profile: toPrivateStudentDTO(profile),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/employer-verification/me (Kiểm tra trạng thái xác minh của NTD hiện tại)
router.get('/employer-verification/me', authenticate, async (req, res, next) => {
  try {
    const verification = await EmployerVerification.findOne({ employerUserId: req.user._id });
    res.json(verification || { status: 'draft' });
  } catch (err) {
    next(err);
  }
});

// POST /api/profiles/employer-verification/submit (NTD nộp hồ sơ xác minh để Admin duyệt)
router.post('/employer-verification/submit', authenticate, async (req, res, next) => {
  try {
    const allowedRoles = ['pending', 'employer', 'admin'];
    if (!allowedRoles.includes(req.user.role) && req.user.status !== 'pending') {
      return res.status(403).json({
        error: 'Tài khoản không đủ quyền để nộp hồ sơ nhà tuyển dụng.',
        code: 'FORBIDDEN',
      });
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
      return res.status(400).json({
        error: 'Vui lòng cung cấp đầy đủ tên cơ sở, người đại diện, địa chỉ và số điện thoại liên hệ.',
        code: 'MISSING_FIELDS',
      });
    }

    // Upsert hồ sơ cửa hàng
    await EmployerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          userId: req.user._id,
          storeName: storeName.trim(),
          storeType: (storeType || 'Cửa hàng').trim(),
          address: businessAddress.trim(),
          contactPhone: contactPhone.trim(),
          contactName: legalName.trim(),
          description: (description || '').trim(),
          verified: false,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Cập nhật trạng thái người dùng thành employer, pending
    await User.findByIdAndUpdate(req.user._id, {
      role: 'employer',
      status: 'pending',
    });

    const verification = await EmployerVerification.findOneAndUpdate(
      { employerUserId: req.user._id },
      {
        $set: {
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
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: 'Hồ sơ xác minh đã được gửi thành công và đang chờ Ban Quản Trị xét duyệt.',
      verification,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
export {
  STUDENT_SELF_UPDATE_FIELDS,
  EMPLOYER_SELF_UPDATE_FIELDS,
  ADMIN_ALLOWED_FIELDS_STUDENT,
  ADMIN_ALLOWED_FIELDS_EMPLOYER,
  toPublicStudentDTO,
  toPrivateStudentDTO,
  toPublicEmployerDTO,
  toPrivateEmployerDTO,
};
