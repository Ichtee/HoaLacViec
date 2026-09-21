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

// Helper: Compute match score combining Schedule + Distance
function computeMatch(job, availability, studentLocation) {
  let scheduleScore = 80; // default baseline
  let hasConflict = false;

  // Schedule match calculation
  if (availability && availability.slots && job.schedule && job.schedule.length > 0) {
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
  }

  // Distance match calculation
  let distanceKm = null;
  let distanceScore = 80;
  if (studentLocation && job.location) {
    distanceKm = calculateDistance(
      studentLocation.lat, studentLocation.lng,
      job.location.lat, job.location.lng
    );
    if (distanceKm !== null) {
      if (distanceKm <= 1.0) distanceScore = 100; // Siêu gần, đi bộ được (< 1km)
      else if (distanceKm <= 2.5) distanceScore = 85; // Đi xe đạp/xe máy 5 phút
      else if (distanceKm <= 5.0) distanceScore = 70; // Hòa Lạc nội khu
      else distanceScore = Math.max(30, Math.round(100 - distanceKm * 7));
    }
  }

  // Overall combined score: 60% schedule + 40% distance
  const overallScore = Math.round(scheduleScore * 0.6 + distanceScore * 0.4);

  return {
    score: overallScore,
    scheduleScore,
    distanceScore,
    distanceKm,
    hasConflict,
    recommendation: distanceKm !== null && distanceKm <= 1.2
      ? 'Rất gần (~' + distanceKm + 'km, có thể đi bộ)'
      : distanceKm !== null
      ? 'Cách ' + distanceKm + 'km'
      : 'Khu vực Hòa Lạc'
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
      status,
      limit = 50,
      featured,
      sort,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    } else if (!storeName && !employerId) {
      // Default public view only displays approved jobs
      filter.status = 'approved';
    }

    if (storeName || employerId) {
      const orConditions = [];
      if (storeName) {
        orConditions.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
      }
      if (employerId) {
        orConditions.push({ employerId: employerId });
        try {
          const profile = await EmployerProfile.findOne({ userId: employerId });
          if (profile) {
            orConditions.push({ employerId: profile._id });
            if (profile.storeName) {
              orConditions.push({ storeName: { $regex: new RegExp(`^${profile.storeName}$`, 'i') } });
            }
          }
        } catch (e) {}
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }
    }

    if (search) {
      const searchRegex = createVietnameseRegex(search);
      const tagRegex = new RegExp(search.trim().replace(/\s+/g, '_'), 'i');
      filter.$or = [
        { title: { $regex: searchRegex } },
        { storeName: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { address: { $regex: searchRegex } },
        { tags: { $in: [searchRegex, tagRegex] } },
      ];
    }

    if (type) filter.type = type;
    if (area) filter.area = area;
    if (featured === 'true') filter.featured = true;

    let jobs = await Job.find(filter).sort({ featured: -1, createdAt: -1 }).limit(Number(limit)).lean();

    // If studentId provided, enhance with schedule and distance match score!
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

    res.json({ jobs, total: jobs.length });
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
    data.employerId = profile ? profile._id : req.user._id;
    if (profile?.storeName && !data.storeName) {
      data.storeName = profile.storeName;
    }

    // Normalize salary
    if (!data.salaryAmount && (data.salaryMin || data.salaryText)) {
      data.salaryAmount = Number(data.salaryMin) || parseInt(String(data.salaryText).replace(/\D/g, '')) || 25000;
    }
    if (!data.salaryUnit) data.salaryUnit = 'hour';

    // Status: if profile is verified or admin, approve; else pending
    if (req.user.role === 'admin' || profile?.verified) {
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

      if (job.employerId && !allowedOwnerIds.includes(job.employerId.toString())) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin tuyển dụng này.' });
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

      if (job.employerId && !allowedOwnerIds.includes(job.employerId.toString())) {
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

