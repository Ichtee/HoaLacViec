import express from 'express';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';

const router = express.Router();

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
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

export default router;

