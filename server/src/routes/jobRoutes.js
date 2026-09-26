import express from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Availability } from '../models/Availability.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Application } from '../models/Application.js';
import { Shift } from '../models/Shift.js';
import { resolveGoogleMapInput } from '../utils/parseMapLink.js';
import { searchGoogleMapsPlaces } from '../services/serpApi.js';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth.js';
import { isValidCoordinate, calculateHaversineDistanceMeters } from '../utils/geoHelper.js';
import { geocodeAddress } from '../services/geocodingService.js';
import { normalizeLocationInput, LOCATION_STATUSES } from '../utils/locationContract.js';

const router = express.Router();

// Helper: Create Vietnamese diacritic-agnostic regex
function createVietnameseRegex(query) {
  if (!query) return null;
  const map = {
    a: '[aàáảãạăằắẳẵặâầấẩẫậ]',
    e: '[eèéẻẽẹêềếểễệ]',
    i: '[iìíỉĩị]',
    o: '[oòóỏõọôồốổỗộơờớởỡợ]',
    u: '[uùúủũụưừứửữự]',
    y: '[yỳýỷỹỵ]',
    d: '[dđ]',
  };
  const pattern = query
    .trim()
    .split('')
    .map(char => {
      const lower = char.toLowerCase();
      if (map[lower]) return map[lower];
      if (char === ' ' || char === '-') return '[\\s_\\-]';
      return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(pattern, 'i');
}

// Helper: Compute match score combining Schedule + Distance without fake baselines
function computeMatch(job, availability, studentLocation) {
  let scheduleScore = null;
  let hasConflict = false;
  let scheduleInfo = 'Chưa có thông tin lịch rảnh';

  if (availability && availability.slots && Object.keys(availability.slots).length > 0 && job.schedule && job.schedule.length > 0) {
    const dayKeys = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    let matches = 0;
    job.schedule.forEach(s => {
      const dayKey = dayKeys[s.dayOfWeek];
      const availableSlots = availability.slots[dayKey] || [];
      if (s.slot && availableSlots.includes(s.slot)) {
        matches++;
      } else if (!s.slot && availableSlots.length > 0) {
        matches++;
      } else {
        hasConflict = true;
      }
    });
    scheduleScore = Math.round((matches / job.schedule.length) * 100);
    scheduleInfo = hasConflict
      ? `Khớp ${matches}/${job.schedule.length} ca làm`
      : 'Trùng khớp 100% lịch rảnh';
  }

  let distanceKm = null;
  let distanceScore = null;
  let distanceInfo = 'Chưa thiết lập vị trí sinh viên';

  if (
    studentLocation &&
    isValidCoordinate(studentLocation.lat, studentLocation.lng) &&
    job.location &&
    isValidCoordinate(job.location.lat, job.location.lng)
  ) {
    const distMeters = calculateHaversineDistanceMeters(
      studentLocation.lat, studentLocation.lng,
      job.location.lat, job.location.lng
    );
    if (distMeters !== null) {
      distanceKm = Math.round((distMeters / 1000) * 10) / 10;
      if (distanceKm <= 1.0) distanceScore = 100;
      else if (distanceKm <= 2.5) distanceScore = 85;
      else if (distanceKm <= 5.0) distanceScore = 70;
      else distanceScore = Math.max(30, Math.round(100 - distanceKm * 7));

      distanceInfo = distanceKm <= 1.2
        ? `Rất gần (~${distanceKm}km, có thể đi bộ)`
        : `Cách ${distanceKm}km`;
    }
  }

  let overallScore = null;
  if (scheduleScore !== null && distanceScore !== null) {
    overallScore = Math.round(scheduleScore * 0.6 + distanceScore * 0.4);
  } else if (scheduleScore !== null) {
    overallScore = scheduleScore;
  } else if (distanceScore !== null) {
    overallScore = distanceScore;
  }

  return {
    score: overallScore,
    scheduleScore,
    distanceScore,
    distanceKm,
    hasConflict,
    hasEnoughData: overallScore !== null,
    scheduleInfo,
    distanceInfo,
    recommendation: distanceInfo,
  };
}

// GET /api/jobs/employer/my-jobs (Authenticated - Employer view own jobs at all lifecycle states)
router.get('/employer/my-jobs', authenticate, authorize('employer', 'admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const filter = { archivedAt: null };

    if (req.user.role === 'employer') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedOwnerIds = [req.user._id];
      if (profile) allowedOwnerIds.push(profile._id);

      filter.$or = [
        { employerUserId: req.user._id },
        { employerProfileId: { $in: allowedOwnerIds } },
        { employerId: { $in: allowedOwnerIds } },
      ];
    } else if (req.user.role === 'admin' && req.query.employerUserId) {
      filter.employerUserId = req.query.employerUserId;
    }

    if (status) {
      filter.status = status;
    }

    const total = await Job.countDocuments(filter);
    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      items: jobs,
      jobs,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs (Public queries - ONLY returns approved, active, unexpired, non-archived jobs)
router.get('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const {
      search,
      category,
      type,
      area,
      studentId,
      page = 1,
      limit = 50,
      featured,
      verified,
      minSalary,
      sort,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const andConditions = [];

    // Security & Visibility: Public visitors only see approved, unexpired, active jobs
    andConditions.push({ status: 'approved' });
    andConditions.push({ archivedAt: null });
    andConditions.push({
      $or: [
        { closesAt: null },
        { closesAt: { $exists: false } },
        { closesAt: { $gt: new Date() } },
      ],
    });

    // Category filter (real backend filtering)
    if (category && category !== 'all') {
      andConditions.push({
        $or: [
          { category: category.trim() },
          { tags: category.trim() },
        ],
      });
    }

    // Type and Area filters
    if (type) andConditions.push({ type });
    if (area) andConditions.push({ area });

    // Featured filter
    if (featured === 'true') {
      andConditions.push({ featured: true });
    }

    // Minimum salary filter
    if (minSalary && !isNaN(Number(minSalary))) {
      andConditions.push({ salaryAmount: { $gte: Number(minSalary) } });
    }

    // Verified employer filter (real backend check)
    if (verified === 'true') {
      const verifiedProfiles = await EmployerProfile.find({ verified: true }).select('_id userId').lean();
      const verifiedProfileIds = verifiedProfiles.map(p => p._id);
      const verifiedUserIds = verifiedProfiles.map(p => p.userId).filter(Boolean);
      andConditions.push({
        $or: [
          { employerProfileId: { $in: verifiedProfileIds } },
          { employerUserId: { $in: verifiedUserIds } },
          { employerId: { $in: verifiedProfileIds } },
        ],
      });
    }

    // Search filter (diacritic-insensitive)
    if (search) {
      const searchRegex = createVietnameseRegex(search);
      const tagRegex = new RegExp(search.trim().replace(/\s+/g, '_'), 'i');
      andConditions.push({
        $or: [
          { title: { $regex: searchRegex } },
          { storeName: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { address: { $regex: searchRegex } },
          { tags: { $in: [searchRegex, tagRegex] } },
        ],
      });
    }

    const finalFilter = { $and: andConditions };

    const total = await Job.countDocuments(finalFilter);

    // Sorting
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') {
      sortObj = { createdAt: 1 };
    } else if (sort === 'salary_desc') {
      sortObj = { salaryAmount: -1, createdAt: -1 };
    } else if (sort === 'salary_asc') {
      sortObj = { salaryAmount: 1, createdAt: -1 };
    } else if (sort === 'featured' || featured === 'true') {
      sortObj = { featured: -1, createdAt: -1 };
    }

    let jobs = await Job.find(finalFilter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Attach real employer profile info — NO FAKE FALLBACKS!
    try {
      const employerProfileIds = jobs.map(j => j.employerProfileId || j.employerId).filter(Boolean);
      const employerUserIds = jobs.map(j => j.employerUserId).filter(Boolean);

      const employerProfiles = await EmployerProfile.find({
        $or: [
          { _id: { $in: employerProfileIds } },
          { userId: { $in: employerUserIds } },
        ],
      }).lean();

      const empMap = new Map();
      employerProfiles.forEach(p => {
        empMap.set(p._id.toString(), p);
        if (p.userId) empMap.set(p.userId.toString(), p);
      });

      jobs = jobs.map(job => {
        const emp = (job.employerProfileId && empMap.get(job.employerProfileId.toString())) ||
                    (job.employerUserId && empMap.get(job.employerUserId.toString())) ||
                    (job.employerId && empMap.get(job.employerId.toString())) ||
                    null;

        return {
          ...job,
          employer: emp
            ? {
                storeName: emp.storeName,
                address: emp.address,
                area: emp.area,
                verified: Boolean(emp.verified),
                rating: emp.rating || null,
                ratingCount: emp.ratingCount || 0,
              }
            : {
                storeName: job.storeName,
                address: job.address,
                area: job.area,
                verified: false,
                rating: null,
                ratingCount: 0,
              },
          rating: emp?.rating || null,
        };
      });
    } catch (err) {
      console.warn('Error attaching employer info to jobs:', err.message);
    }

    // Match score if studentId provided
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      const [avail, profile] = await Promise.all([
        Availability.findOne({ userId: studentId }),
        StudentProfile.findOne({ userId: studentId }),
      ]);

      jobs = jobs.map(job => {
        const match = computeMatch(job, avail, profile?.location);
        return {
          ...job,
          matchResult: match,
          matchScore: match.score,
        };
      });

      if (sort === 'match') {
        jobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      }
    }

    res.json({
      items: jobs,
      jobs,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id (Public view 404s unapproved jobs; Owner or Admin can view)
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });
    }

    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });
    }

    // If job is not approved or is archived, only the owner employer or admin may view it
    if (job.status !== 'approved' || job.archivedAt) {
      const isOwner = req.user && job.employerUserId && job.employerUserId.toString() === req.user._id.toString();
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });
      }
    }

    // Attach real employer profile
    let employer = null;
    if (job.employerProfileId || job.employerId) {
      employer = await EmployerProfile.findOne({
        $or: [
          { _id: job.employerProfileId || job.employerId },
          { userId: job.employerUserId },
        ],
      }).lean();
    }

    const { studentId } = req.query;
    let matchResult = null;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      const [avail, profile] = await Promise.all([
        Availability.findOne({ userId: studentId }),
        StudentProfile.findOne({ userId: studentId }),
      ]);
      matchResult = computeMatch(job, avail, profile?.location);
    }

    res.json({
      ...job,
      employer: employer
        ? {
            storeName: employer.storeName,
            address: employer.address,
            area: employer.area,
            contactPhone: employer.contactPhone,
            verified: Boolean(employer.verified),
            rating: employer.rating || null,
            ratingCount: employer.ratingCount || 0,
          }
        : {
            storeName: job.storeName,
            address: job.address,
            area: job.area,
            contactPhone: job.contactPhone,
            verified: false,
            rating: null,
            ratingCount: 0,
          },
      matchResult,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs (Employer/Admin create job)
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Chỉ nhà tuyển dụng hoặc quản trị viên mới có quyền đăng tin tuyển dụng.',
        code: 'FORBIDDEN',
      });
    }

    const profile = await EmployerProfile.findOne({ userId: req.user._id });
    const data = { ...req.body };

    data.employerUserId = req.user._id;
    if (profile) {
      data.employerProfileId = profile._id;
      data.employerId = profile._id;
      if (profile.storeName && !data.storeName) {
        data.storeName = profile.storeName;
      }
    } else {
      data.employerId = req.user._id;
    }

    // Normalize salary
    if (!data.salaryAmount && (data.salaryMin || data.salaryText)) {
      data.salaryAmount = Number(data.salaryMin) || parseInt(String(data.salaryText).replace(/\D/g, '')) || 25000;
    }
    if (!data.salaryUnit) data.salaryUnit = 'hour';

    // Status: draft if requested, otherwise pending for admin approval; admin can directly approve
    if (req.user.role === 'admin') {
      data.status = data.status || 'approved';
    } else {
      data.status = data.status === 'draft' ? 'draft' : 'pending';
    }

    // If employer wants to submit immediately to pending, check verified
    if (data.status === 'pending' && req.user.role !== 'admin') {
      if (!profile || !profile.verified) {
        // Can only save as draft if not verified
        data.status = 'draft';
      }
    }

    // Normalize requirements & benefits
    if (typeof data.requirements === 'string') {
      data.requirements = data.requirements.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    }
    if (typeof data.benefits === 'string') {
      data.benefits = data.benefits.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    }

    // Normalize location & address: Canonical contract with real coordinates only
    const normalizedLoc = normalizeLocationInput(data, null, {
      isExplicitConfirm: data.locationStatus === LOCATION_STATUSES.CONFIRMED,
    });
    Object.assign(data, normalizedLoc);

    const newJob = await Job.create(data);
    res.status(201).json(newJob);
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/submit (Draft -> Pending, Requires verified employer)
router.post('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin' && job.employerUserId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền gửi duyệt tin tuyển dụng này.', code: 'FORBIDDEN' });
    }

    if (job.status !== 'draft') {
      return res.status(400).json({ error: `Chỉ tin ở trạng thái bản nháp (draft) mới có thể gửi duyệt (hiện tại: ${job.status}).`, code: 'INVALID_STATE' });
    }

    // Employer must be verified to submit for approval
    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      if (!profile || !profile.verified) {
        return res.status(403).json({
          error: 'Chỉ nhà tuyển dụng đã xác minh tài khoản mới được gửi tin tuyển dụng để xét duyệt.',
          code: 'EMPLOYER_NOT_VERIFIED',
        });
      }
    }

    job.status = 'pending';
    job.moderationNote = 'Chờ xét duyệt từ Ban Quản Trị';
    await job.save();

    res.json({ message: 'Tin tuyển dụng đã được gửi duyệt thành công.', job });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/pause (Approved -> Paused)
router.post('/:id/pause', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin' && job.employerUserId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền tạm dừng tin tuyển dụng này.', code: 'FORBIDDEN' });
    }

    if (job.status !== 'approved') {
      return res.status(400).json({ error: 'Chỉ có thể tạm dừng tin đang hoạt động (approved).', code: 'INVALID_STATE' });
    }

    job.status = 'paused';
    await job.save();

    res.json({ message: 'Đã tạm dừng nhận hồ sơ tuyển dụng.', job });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/close (Approved|Paused -> Closed)
router.post('/:id/close', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin' && job.employerUserId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền đóng tin tuyển dụng này.', code: 'FORBIDDEN' });
    }

    if (!['approved', 'paused'].includes(job.status)) {
      return res.status(400).json({ error: 'Chỉ có thể đóng tin đang hoạt động hoặc đang tạm dừng.', code: 'INVALID_STATE' });
    }

    job.status = 'closed';
    await job.save();

    res.json({ message: 'Đã đóng tuyển dụng cho vị trí này.', job });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/reopen (Paused|Closed -> Pending, must re-moderate)
router.post('/:id/reopen', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin' && job.employerUserId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền mở lại tin tuyển dụng này.', code: 'FORBIDDEN' });
    }

    if (!['paused', 'closed'].includes(job.status)) {
      return res.status(400).json({ error: 'Chỉ có thể mở lại tin đang đóng hoặc đang tạm dừng.', code: 'INVALID_STATE' });
    }

    // Reopen MUST return to pending for admin re-approval
    job.status = 'pending';
    job.moderationNote = 'Tin tuyển dụng được mở lại và chờ xét duyệt.';
    await job.save();

    res.json({ message: 'Tin tuyển dụng đã được gửi lại để Ban Quản Trị xét duyệt.', job });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/approve (Admin only: Pending -> Approved)
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    job.status = 'approved';
    job.moderatedBy = req.user._id;
    job.moderatedAt = new Date();
    job.moderationNote = 'Đã được duyệt bởi Quản trị viên.';
    job.rejectionReason = '';
    await job.save();

    res.json({ message: 'Đã phê duyệt tin tuyển dụng thành công.', job });
  } catch (err) {
    next(err);
  }
});

// ACTION: POST /api/jobs/:id/reject (Admin only: Pending -> Rejected)
router.post('/:id/reject', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    job.status = 'rejected';
    job.moderatedBy = req.user._id;
    job.moderatedAt = new Date();
    job.rejectionReason = reason || 'Thông tin tin tuyển dụng chưa đáp ứng quy chuẩn.';
    await job.save();

    res.json({ message: 'Đã từ chối tin tuyển dụng.', job });
  } catch (err) {
    next(err);
  }
});

// PUT /api/jobs/:id (Update job - Owner or Admin)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner = job.employerUserId && job.employerUserId.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin tuyển dụng này.', code: 'FORBIDDEN' });
      }

      // Strip protected fields
      delete req.body.employerUserId;
      delete req.body.employerProfileId;
      delete req.body.employerId;
      delete req.body.featured;
      delete req.body.moderatedBy;
      delete req.body.moderatedAt;
      delete req.body.archivedAt;

      // If approved job changes core information, revert to pending for review
      const isChangingCore = req.body.title || req.body.salaryAmount || req.body.address || req.body.schedule || req.body.location;
      if (job.status === 'approved' && isChangingCore) {
        req.body.status = 'pending';
        req.body.moderationNote = 'Tin tuyển dụng cần duyệt lại do thay đổi nội dung quan trọng.';
      } else if (req.body.status && !['paused', 'closed', 'draft', 'pending'].includes(req.body.status)) {
        delete req.body.status;
      }
    }

    const existingJob = await Job.findById(req.params.id);
    if (!existingJob) return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });

    // Normalize location & address using authoritative contract
    if (
      req.body.location !== undefined ||
      req.body.locationStatus !== undefined ||
      req.body.address !== undefined ||
      req.body.addressComponents !== undefined ||
      req.body.locationSource !== undefined
    ) {
      const normalizedLoc = normalizeLocationInput(req.body, existingJob, {
        isExplicitConfirm: req.body.locationStatus === LOCATION_STATUSES.CONFIRMED,
      });
      Object.assign(req.body, normalizedLoc);
    }

    const updated = await Job.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/location/confirm (Explicit location confirmation)
router.post('/:id/location/confirm', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin' && job.employerUserId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xác nhận vị trí cho tin tuyển dụng này.', code: 'FORBIDDEN' });
    }

    const payload = {
      location: req.body.location || job.location,
      address: req.body.address || job.address,
      addressComponents: req.body.addressComponents || job.addressComponents,
      locationSource: req.body.locationSource || job.locationSource || 'map_pin',
      locationStatus: 'confirmed',
    };

    const normalizedLoc = normalizeLocationInput(payload, job, { isExplicitConfirm: true });
    if (normalizedLoc.locationStatus !== LOCATION_STATUSES.CONFIRMED || !normalizedLoc.geoPoint) {
      return res.status(400).json({
        error: 'Tọa độ không hợp lệ, không thể xác nhận vị trí.',
        code: 'INVALID_COORDINATES',
      });
    }

    Object.assign(job, normalizedLoc);
    if (req.body.address) job.address = req.body.address;
    await job.save();

    res.json({ message: 'Vị trí đã được xác nhận thành công.', job });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jobs/:id (Owner or Admin: soft delete if has application/shift, else hard delete)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm', code: 'JOB_NOT_FOUND' });

    if (req.user.role !== 'admin') {
      const isOwner = job.employerUserId && job.employerUserId.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa tin tuyển dụng này.', code: 'FORBIDDEN' });
      }
    }

    // Check if job has applications or shifts
    const [appCount, shiftCount] = await Promise.all([
      Application.countDocuments({ jobId: job._id }),
      Shift.countDocuments({ jobId: job._id }),
    ]);

    if (appCount > 0 || shiftCount > 0) {
      // Soft-delete with archivedAt to preserve history and contract integrity
      job.archivedAt = new Date();
      job.status = 'closed';
      await job.save();
      return res.json({
        message: 'Tin tuyển dụng đã có người ứng tuyển hoặc ca làm việc, đã được chuyển sang chế độ lưu trữ.',
        archived: true,
        job,
      });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa hoàn toàn tin tuyển dụng.', archived: false });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/geocode (OpenStreetMap Nominatim geocoding)
router.post('/geocode', async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp địa chỉ cần tìm tọa độ.' });
    }
    const result = await geocodeAddress(address);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/resolve-map-link
router.post('/resolve-map-link', async (req, res, next) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp link hoặc tọa độ' });
    }
    const coords = await resolveGoogleMapInput(input);
    if (!coords) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tọa độ từ liên kết hoặc dữ liệu này' });
    }
    res.json({ success: true, lat: coords.lat, lng: coords.lng });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/search-places (via SerpApi Google Maps)
router.post('/search-places', async (req, res, next) => {
  try {
    const { query, center } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập từ khóa tìm kiếm' });
    }
    const places = await searchGoogleMapsPlaces(query, center);
    res.json({ success: true, places });
  } catch (err) {
    next(err);
  }
});

export default router;
