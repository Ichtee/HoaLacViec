import express from 'express';
import mongoose from 'mongoose';
import { SavedJob } from '../models/SavedJob.js';
import { Job } from '../models/Job.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Require authentication for all saved job routes
router.use(authenticate);

// GET /api/saved-jobs/ids (Lấy danh sách ID các việc làm đã lưu để hiển thị icon nhanh)
router.get('/ids', async (req, res) => {
  try {
    const saved = await SavedJob.find({ userId: req.user._id }).select('jobId').lean();
    const ids = saved.map(s => s.jobId.toString());
    res.json(ids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/saved-jobs (Lấy toàn bộ danh sách việc làm đã lưu của người dùng)
router.get('/', async (req, res) => {
  try {
    const savedList = await SavedJob.find({ userId: req.user._id })
      .populate({
        path: 'jobId',
        select: 'title storeName salaryAmount salaryUnit address area location type status tags featured',
      })
      .sort({ createdAt: -1 })
      .lean();

    // Format list, keeping even closed/expired jobs with proper status flag
    const formatted = savedList
      .filter(item => item.jobId) // Ensure job still exists in DB
      .map(item => {
        const job = item.jobId;
        return {
          ...job,
          id: job._id,
          savedAt: item.createdAt,
          isSaved: true,
          isAvailable: job.status === 'approved',
        };
      });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/saved-jobs/:jobId (Lưu việc làm)
router.post('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Mã việc làm không hợp lệ' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm để lưu' });
    }

    const saved = await SavedJob.findOneAndUpdate(
      { userId: req.user._id, jobId },
      { userId: req.user._id, jobId },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Đã lưu việc làm thành công', saved, isSaved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/saved-jobs/:jobId (Bỏ lưu việc làm)
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await SavedJob.findOneAndDelete({ userId: req.user._id, jobId });
    res.json({ message: 'Đã bỏ lưu việc làm', isSaved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
