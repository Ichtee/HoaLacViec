import express from 'express';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Application } from '../models/Application.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Enforce admin-only access for all /api/admin routes
router.use(authenticate, authorize('admin'));

// GET /api/admin/stats (Tổng quan thống kê quản trị)
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      studentCount,
      employerCount,
      totalJobs,
      pendingJobs,
      approvedJobs,
      pendingEmployerVerifications,
      pendingStudentVerifications,
      totalApplications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'approved' }),
      EmployerVerification.countDocuments({ status: 'pending' }),
      StudentProfile.countDocuments({ verificationStatus: 'pending' }),
      Application.countDocuments(),
    ]);

    res.json({
      users: { total: totalUsers, students: studentCount, employers: employerCount },
      jobs: { total: totalJobs, pending: pendingJobs, approved: approvedJobs },
      verifications: {
        pending: pendingEmployerVerifications + pendingStudentVerifications,
        employerPending: pendingEmployerVerifications,
        studentPending: pendingStudentVerifications,
      },
      applications: { total: totalApplications },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/status (Khóa/Mở tài khoản người dùng)
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'locked', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/role (Thay đổi Role của người dùng)
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'worker', 'freelancer', 'employer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ (chấp nhận student, worker, freelancer, employer, admin)' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    user.role = role;
    if (user.status === 'pending') {
      user.status = 'active';
    }
    await user.save();

    // Tự động đảm bảo Profile tương ứng tồn tại để user không bị lỗi khi truy cập
    if (role === 'student') {
      const existingProfile = await StudentProfile.findOne({ userId: user._id });
      if (!existingProfile) {
        await StudentProfile.create({
          userId: user._id,
          profileType: 'student',
          university: 'Đại học FPT Hòa Lạc',
          major: 'Kỹ thuật phần mềm',
          studentCode: 'SE' + Math.floor(100000 + Math.random() * 900000),
          address: 'Ký túc xá ĐH FPT, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội',
          location: { lat: 21.0135, lng: 105.5252 },
          geoPoint: { type: 'Point', coordinates: [105.5252, 21.0135] },
          locationStatus: 'confirmed',
          locationSource: 'map_pin',
          verified: true,
        });
      }
    } else if (role === 'worker' || role === 'freelancer') {
      const existingProfile = await StudentProfile.findOne({ userId: user._id });
      if (!existingProfile) {
        await StudentProfile.create({
          userId: user._id,
          profileType: 'worker',
          profession: 'Lao động tự do',
          idCardNumber: '00120' + Math.floor(1000000 + Math.random() * 9000000),
          address: 'Khu CNC Hòa Lạc, Thạch Thất, Hà Nội',
          location: { lat: 21.0135, lng: 105.5252 },
          geoPoint: { type: 'Point', coordinates: [105.5252, 21.0135] },
          locationStatus: 'confirmed',
          locationSource: 'map_pin',
          verified: true,
        });
      } else if (!existingProfile.profileType || existingProfile.profileType === 'student') {
        existingProfile.profileType = 'worker';
        await existingProfile.save();
      }
    } else if (role === 'employer') {
      const existingProfile = await EmployerProfile.findOne({ userId: user._id });
      if (!existingProfile) {
        await EmployerProfile.create({
          userId: user._id,
          storeName: user.name ? `${user.name} Store` : 'Cửa hàng Hoa Lạc',
          address: 'Khu Công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội',
          location: { lat: 21.0135, lng: 105.5252 },
          geoPoint: { type: 'Point', coordinates: [105.5252, 21.0135] },
          locationStatus: 'confirmed',
          locationSource: 'map_pin',
          verified: true,
        });
      }
    }

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/jobs
router.get('/jobs', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    const jobs = await Job.find(filter)
      .populate('employerUserId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/jobs/:id/approve (Admin duyệt việc làm)
router.post('/jobs/:id/approve', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        moderatedBy: req.user._id,
        moderatedAt: new Date(),
        rejectionReason: '',
      },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });
    res.json({ message: 'Đã phê duyệt tin tuyển dụng', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/jobs/:id/reject (Admin từ chối việc làm kèm lý do)
router.post('/jobs/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        moderatedBy: req.user._id,
        moderatedAt: new Date(),
        rejectionReason: reason || 'Nội dung tin tuyển dụng chưa đáp ứng tiêu chuẩn cộng đồng.',
      },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });
    res.json({ message: 'Đã từ chối tin tuyển dụng', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/jobs/:id
router.put('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/jobs/:id (Xóa việc làm vi phạm)
router.delete('/jobs/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã gỡ bỏ bài đăng việc làm' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/verifications (Lấy danh sách hồ sơ xác minh doanh nghiệp & sinh viên)
router.get('/verifications', async (req, res) => {
  try {
    const { status, type } = req.query; // type: 'all' | 'employer' | 'student'
    const results = [];

    const statusFilter = status && status !== 'all' ? status : null;

    // 1. Fetch Employer Verifications
    if (!type || type === 'all' || type === 'employer') {
      const empFilter = statusFilter ? { status: statusFilter } : {};
      const employerVerifications = await EmployerVerification.find(empFilter)
        .populate('employerUserId', 'name email phone avatar')
        .sort({ createdAt: -1 });

      for (const ev of employerVerifications) {
        results.push({
          _id: ev._id,
          id: ev._id,
          verificationType: 'employer',
          storeName: ev.storeName,
          legalName: ev.legalName,
          taxCode: ev.taxCode,
          idCardNumber: ev.idCardNumber,
          businessAddress: ev.businessAddress,
          contactPhone: ev.contactPhone,
          documents: ev.documents,
          status: ev.status,
          rejectionReason: ev.rejectionReason,
          reviewedBy: ev.reviewedBy,
          reviewedAt: ev.reviewedAt,
          createdAt: ev.createdAt,
          user: ev.employerUserId,
        });
      }

      // Fallback: If no EmployerVerification records exist yet, also check unverified EmployerProfiles
      if (employerVerifications.length === 0 && (!statusFilter || statusFilter === 'pending')) {
        const stores = await EmployerProfile.find({ verified: false }).populate('userId', 'name email phone avatar');
        for (const st of stores) {
          results.push({
            _id: st._id,
            id: st._id,
            verificationType: 'employer',
            storeName: st.storeName,
            legalName: st.contactName,
            businessAddress: st.address,
            contactPhone: st.contactPhone,
            documents: [],
            status: 'pending',
            rejectionReason: '',
            createdAt: st.createdAt,
            user: st.userId,
          });
        }
      }
    }

    // 2. Fetch Student & Worker Verifications
    if (!type || type === 'all' || type === 'student' || type === 'worker') {
      const stuFilter = {};
      if (statusFilter) {
        stuFilter.verificationStatus = statusFilter;
      } else {
        // Return records with pending, approved, or rejected status, or who provided code/id or uploaded a photo
        stuFilter.$or = [
          { verificationStatus: { $in: ['pending', 'approved', 'rejected'] } },
          { studentCardPhoto: { $ne: '' } },
          { idCardFrontPhoto: { $ne: '' } },
          { idCardNumber: { $ne: '' } },
          { studentCode: { $ne: '' } },
        ];
      }

      const profiles = await StudentProfile.find(stuFilter)
        .populate('userId', 'name email phone avatar status role')
        .sort({ updatedAt: -1 });

      for (const sp of profiles) {
        const isWorker = sp.profileType === 'worker' || (Boolean(sp.idCardFrontPhoto || sp.idCardNumber) && !sp.studentCode);
        const verificationType = isWorker ? 'worker' : 'student';

        // Filter by tab if selected
        if (type && type !== 'all' && type !== verificationType) continue;

        const hasSubmission = isWorker
          ? Boolean(sp.idCardFrontPhoto || sp.idCardNumber)
          : Boolean(sp.studentCardPhoto || sp.studentCode);

        const normalizedStatus = sp.verificationStatus === 'draft' 
          ? (hasSubmission ? 'pending' : 'draft')
          : (sp.verificationStatus || (sp.verified ? 'approved' : 'pending'));

        // Skip drafts without submissions
        if (normalizedStatus === 'draft') continue;

        results.push({
          _id: sp._id,
          id: sp._id,
          verificationType,
          // Student fields
          studentCode: sp.studentCode,
          university: sp.university,
          major: sp.major,
          studentCardPhoto: sp.studentCardPhoto,
          // Worker CCCD fields
          idCardNumber: sp.idCardNumber,
          idCardFrontPhoto: sp.idCardFrontPhoto,
          idCardBackPhoto: sp.idCardBackPhoto,
          profession: sp.profession,
          // Shared fields
          transport: sp.transport,
          status: normalizedStatus,
          verified: sp.verified,
          rejectionReason: sp.rejectionReason,
          reviewedBy: sp.reviewedBy,
          reviewedAt: sp.reviewedAt,
          createdAt: sp.updatedAt || sp.createdAt,
          user: sp.userId,
        });
      }
    }

    // Sort combined by createdAt descending
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/approve (Duyệt xác minh doanh nghiệp, sinh viên hoặc người lao động)
router.post('/verifications/:id/approve', async (req, res) => {
  try {
    // 1. Check if ID matches StudentProfile (student or worker)
    const studentProfile = await StudentProfile.findById(req.params.id);
    if (studentProfile) {
      studentProfile.verified = true;
      studentProfile.verificationStatus = 'approved';
      studentProfile.rejectionReason = '';
      studentProfile.reviewedBy = req.user._id;
      studentProfile.reviewedAt = new Date();
      studentProfile.verifiedAt = new Date();
      await studentProfile.save();

      const isWorker = studentProfile.profileType === 'worker' || (Boolean(studentProfile.idCardFrontPhoto || studentProfile.idCardNumber) && !studentProfile.studentCode);
      const targetRole = isWorker ? 'worker' : 'student';

      // Activate user account & set role
      await User.findByIdAndUpdate(studentProfile.userId, {
        role: targetRole,
        status: 'active',
      });

      return res.json({
        message: isWorker ? 'Đã duyệt Căn cước công dân người lao động tự do thành công!' : 'Đã duyệt thẻ sinh viên thành công!',
        profile: studentProfile
      });
    }

    // 2. Try updating EmployerVerification
    const verification = await EmployerVerification.findById(req.params.id);
    if (verification) {
      verification.status = 'approved';
      verification.reviewedBy = req.user._id;
      verification.reviewedAt = new Date();
      verification.rejectionReason = '';
      await verification.save();

      // Update employer profile
      await EmployerProfile.findOneAndUpdate(
        { userId: verification.employerUserId },
        { verified: true, verifiedAt: new Date() }
      );

      // Activate user account
      await User.findByIdAndUpdate(verification.employerUserId, {
        role: 'employer',
        status: 'active',
      });

      return res.json({ message: 'Đã duyệt xác minh doanh nghiệp thành công!', verification });
    }

    // 3. Fallback if ID is an EmployerProfile
    const store = await EmployerProfile.findByIdAndUpdate(
      req.params.id,
      { verified: true, verifiedAt: new Date() },
      { new: true }
    );
    if (!store) return res.status(404).json({ error: 'Không tìm thấy hồ sơ xác minh' });

    await EmployerVerification.findOneAndUpdate(
      { employerUserId: store.userId },
      { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date() },
      { upsert: true }
    );

    // Activate user account
    await User.findByIdAndUpdate(store.userId, {
      role: 'employer',
      status: 'active',
    });

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/reject (Từ chối xác minh doanh nghiệp hoặc sinh viên)
router.post('/verifications/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const defaultReason = reason || 'Thông tin hoặc giấy tờ xác minh chưa đạt yêu cầu.';

    // 1. Check if ID matches StudentProfile
    const studentProfile = await StudentProfile.findById(req.params.id);
    if (studentProfile) {
      studentProfile.verified = false;
      studentProfile.verificationStatus = 'rejected';
      studentProfile.rejectionReason = defaultReason;
      studentProfile.reviewedBy = req.user._id;
      studentProfile.reviewedAt = new Date();
      await studentProfile.save();

      // Keep user status as pending so they can re-submit
      return res.json({ message: 'Đã từ chối thẻ sinh viên', profile: studentProfile });
    }

    // 2. Try updating EmployerVerification
    const verification = await EmployerVerification.findById(req.params.id);
    if (verification) {
      verification.status = 'rejected';
      verification.rejectionReason = defaultReason;
      verification.reviewedBy = req.user._id;
      verification.reviewedAt = new Date();
      await verification.save();

      await EmployerProfile.findOneAndUpdate(
        { userId: verification.employerUserId },
        { verified: false }
      );

      return res.json({ message: 'Đã từ chối xác minh doanh nghiệp', verification });
    }

    // 3. Fallback if ID is an EmployerProfile
    const store = await EmployerProfile.findByIdAndUpdate(
      req.params.id,
      { verified: false, rejectionReason: defaultReason },
      { new: true }
    );
    if (!store) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

