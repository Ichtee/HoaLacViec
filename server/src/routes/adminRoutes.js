import express from 'express';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Enforce admin-only access for all /api/admin routes
router.use(authenticate, authorize('admin'));

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
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json({ jobs });
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

// GET /api/admin/verifications
router.get('/verifications', async (req, res) => {
  try {
    const stores = await EmployerProfile.find({ verified: false }).populate('userId');
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/approve
router.post('/verifications/:id/approve', async (req, res) => {
  try {
    const store = await EmployerProfile.findByIdAndUpdate(
      req.params.id,
      { verified: true, verifiedAt: new Date() },
      { new: true }
    );
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verifications/:id/reject
router.post('/verifications/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const store = await EmployerProfile.findByIdAndUpdate(
      req.params.id,
      { verified: false, rejectionReason: reason || 'Thông tin xác minh chưa đạt yêu cầu.' },
      { new: true }
    );
    res.json(store);
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

export default router;

