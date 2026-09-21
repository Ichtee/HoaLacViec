import express from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Availability } from '../models/Availability.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { resolveGoogleMapInput } from '../utils/parseMapLink.js';
import { searchGoogleMapsPlaces } from '../services/serpApi.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Helper: Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Helper: Create Vietnamese diacritic-agnostic regex (matches both with and without accents)
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

  // Real Schedule match calculation
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

  // Real Distance match calculation
  let distanceKm = null;
  let distanceScore = null;
  let distanceInfo = 'Chưa thiết lập vị trí sinh viên';

  if (studentLocation && studentLocation.lat && job.location && job.location.lat) {
    distanceKm = calculateDistance(
      studentLocation.lat, studentLocation.lng,
      job.location.lat, job.location.lng
    );
    if (distanceKm !== null) {
      if (distanceKm <= 1.0) distanceScore = 100; // Đi bộ được (< 1km)
      else if (distanceKm <= 2.5) distanceScore = 85; // Đi xe đạp/xe máy 5 phút
      else if (distanceKm <= 5.0) distanceScore = 70; // Hòa Lạc nội khu
      else distanceScore = Math.max(30, Math.round(100 - distanceKm * 7));

      distanceInfo = distanceKm <= 1.2
        ? `Rất gần (~${distanceKm}km, có thể đi bộ)`
        : `Cách ${distanceKm}km`;
    }
  }

  // If both are missing, match score is null
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

// GET /api/jobs
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      type,
      area,
      studentId,
      storeName,
      employerId,
      employerUserId,
      status,
      page = 1,
      limit = 12,
      featured,
      sort,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    const andConditions = [];

    // Status filter: Public visitors only see approved jobs
    if (status) {
      andConditions.push({ status });
    } else if (!storeName && !employerId && !employerUserId) {
      andConditions.push({ status: 'approved' });
    }

    // Employer / Store scoping
    const empTarget = employerUserId || employerId;
    if (storeName || empTarget) {
      const empOr = [];
      if (storeName) {
        empOr.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
      }
      if (empTarget) {
        empOr.push({ employerUserId: empTarget });
        empOr.push({ employerProfileId: empTarget });
        empOr.push({ employerId: empTarget });
        try {
          const profile = await EmployerProfile.findOne({
            $or: [{ _id: empTarget }, { userId: empTarget }]
          });
          if (profile) {
            empOr.push({ employerProfileId: profile._id });
            empOr.push({ employerUserId: profile.userId });
            if (profile.storeName) {
              empOr.push({ storeName: { $regex: new RegExp(`^${profile.storeName}$`, 'i') } });
            }
          }
        } catch (e) {}
      }
      if (empOr.length > 0) {
        andConditions.push({ $or: empOr });
      }
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
        ]
      });
    }

    if (type) andConditions.push({ type });
    if (area) andConditions.push({ area });
    if (featured === 'true') andConditions.push({ featured: true });

    const finalFilter = andConditions.length > 0 ? { $and: andConditions } : {};

    // Get total count server-side
    const total = await Job.countDocuments(finalFilter);

    let jobs = await Job.find(finalFilter)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // If studentId provided, enhance with schedule and distance match score
    if (studentId) {
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
      jobs,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm' });
    }
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });

    let employer = null;
    if (job.employerId) {
      employer = await EmployerProfile.findById(job.employerId).lean();
    }
    if (!employer) {
      employer = await EmployerProfile.findOne({ storeName: job.storeName }).lean();
    }

    const { studentId } = req.query;
    let matchResult = null;
    if (studentId) {
      const [avail, profile] = await Promise.all([
        Availability.findOne({ userId: studentId }),
        StudentProfile.findOne({ userId: studentId }),
      ]);
      matchResult = computeMatch(job, avail, profile?.location);
    }

    res.json({
      ...job,
      employer: employer || {
        storeName: job.storeName,
        address: job.address,
        area: job.area,
        contactPhone: job.contactPhone,
        verified: true,
        rating: 4.8,
        ratingCount: 15,
      },
      matchResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs (Employer create job)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ nhà tuyển dụng hoặc quản trị viên mới có quyền đăng tin tuyển dụng.' });
    }

    const data = { ...req.body };

    // Resolve employer identity from authenticated user
    const profile = await EmployerProfile.findOne({ userId: req.user._id });
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

    // Status: if admin, allow status in body; if verified employer, approve; else pending
    if (req.user.role === 'admin') {
      data.status = data.status || 'approved';
    } else if (profile?.verified) {
      data.status = data.status || 'approved';
    } else {
      data.status = 'pending';
    }

    // Normalize requirements & benefits if given as string
    if (typeof data.requirements === 'string') {
      data.requirements = data.requirements.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    }
    if (typeof data.benefits === 'string') {
      data.benefits = data.benefits.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    }

    // Normalize location & address
    if (typeof data.location === 'string') {
      data.address = data.location;
      data.location = { lat: 21.0128, lng: 105.5255 };
    } else if (!data.location || !data.location.lat) {
      data.location = { lat: 21.0128, lng: 105.5255 };
    }
    if (!data.address) {
      data.address = 'Khu công nghệ cao Hòa Lạc';
    }

    const newJob = await Job.create(data);
    res.status(201).json(newJob);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/jobs/:id (Update job - Owner or Admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedOwnerIds = [req.user._id.toString()];
      if (profile) allowedOwnerIds.push(profile._id.toString());

      const isOwner = (job.employerUserId && job.employerUserId.toString() === req.user._id.toString()) ||
                      (job.employerId && allowedOwnerIds.includes(job.employerId.toString()));
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin tuyển dụng này.' });
      }

      // Strip fields employer is not allowed to mutate directly
      delete req.body.employerUserId;
      delete req.body.employerProfileId;
      delete req.body.employerId;
      delete req.body.featured;
      delete req.body.moderatedBy;
      delete req.body.moderatedAt;

      // State machine check: if approved job modifies critical info, revert to pending for review
      const isChangingCore = req.body.title || req.body.salaryAmount || req.body.address || req.body.schedule || req.body.location;
      if (job.status === 'approved' && isChangingCore) {
        req.body.status = 'pending';
        req.body.moderationNote = 'Tin tuyển dụng cần duyệt lại do thay đổi nội dung quan trọng.';
      } else if (req.body.status && !['paused', 'closed', 'pending'].includes(req.body.status)) {
        delete req.body.status;
      }
    }

    const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/resolve-map-link
router.post('/resolve-map-link', async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/search-places (via SerpApi Google Maps)
router.post('/search-places', async (req, res) => {
  try {
    const { query, center } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập từ khóa tìm kiếm' });
    }
    const places = await searchGoogleMapsPlaces(query, center);
    res.json({ success: true, places });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/jobs/:id (Delete job - Owner or Admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });

    if (req.user.role !== 'admin') {
      const profile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedOwnerIds = [req.user._id.toString()];
      if (profile) allowedOwnerIds.push(profile._id.toString());

      const isOwner = (job.employerUserId && job.employerUserId.toString() === req.user._id.toString()) ||
                      (job.employerId && allowedOwnerIds.includes(job.employerId.toString()));
      if (!isOwner) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa tin tuyển dụng này.' });
      }
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa công việc' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

