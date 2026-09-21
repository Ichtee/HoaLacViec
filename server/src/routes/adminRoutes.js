import express from 'express';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';
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
      pendingVerifications,
      totalApplications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'approved' }),
      EmployerVerification.countDocuments({ status: 'pending' }),
      Application.countDocuments(),
    ]);

    res.json({
      users: { total: totalUsers, students: studentCount, employers: employerCount },
      jobs: { total: totalJobs, pending: pendingJobs, approved: approvedJobs },
      verifications: { pending: pendingVerifications },
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

// GET /api/admin/verifications (Lấy danh sách hồ sơ xác minh doanh nghiệp)
router.get('/verifications', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Try finding in EmployerVerification first
    const verifications = await EmployerVerification.find(filter)
      .populate('employerUserId', 'name email phone')
      .sort({ createdAt: -1 });

    if (verifications.length > 0) {
      return res.json(verifications);
    }

    // Fallback to unverified profiles if verification records not yet created
    const stores = await EmployerProfile.find({ verified: false }).populate('userId');
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/approve (Duyệt xác minh doanh nghiệp)
router.post('/verifications/:id/approve', async (req, res) => {
  try {
    // 1. Try updating EmployerVerification
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

      return res.json({ message: 'Đã duyệt xác minh thành công', verification });
    }

    // 2. Fallback if ID is an EmployerProfile
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

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/reject (Từ chối xác minh doanh nghiệp)
router.post('/verifications/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const defaultReason = reason || 'Thông tin hoặc giấy tờ xác minh chưa đạt yêu cầu.';

    // 1. Try updating EmployerVerification
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

      return res.json({ message: 'Đã từ chối xác minh', verification });
    }

    // 2. Fallback if ID is an EmployerProfile
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

