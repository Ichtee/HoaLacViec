import express from 'express';
import mongoose from 'mongoose';
import { SavedJob } from '../models/SavedJob.js';
import { Job } from '../models/Job.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/saved-jobs/ids (Lấy danh sách ID các việc làm đã lưu)
router.get('/ids', async (req, res, next) => {
  try {
    const saved = await SavedJob.find({ userId: req.user._id }).select('jobId').lean();
    const ids = saved.map(s => s.jobId.toString());
    res.json(ids);
  } catch (err) {
    next(err);
  }
});

// GET /api/saved-jobs (Lấy toàn bộ danh sách việc làm đã lưu của người dùng)
router.get('/', async (req, res, next) => {
  try {
    const savedList = await SavedJob.find({ userId: req.user._id })
      .populate({
        path: 'jobId',
        select: 'title storeName salaryAmount salaryUnit address area location type status tags featured archivedAt',
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = savedList
      .filter(item => item.jobId)
      .map(item => {
        const job = item.jobId;
        return {
          ...job,
          id: job._id,
          savedAt: item.createdAt,
          isSaved: true,
          isAvailable: job.status === 'approved' && !job.archivedAt,
        };
      });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/saved-jobs/toggle/:jobId (Contract: { saved: boolean, jobId })
router.post('/toggle/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Mã việc làm không hợp lệ.', code: 'INVALID_ID' });
    }

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'approved' || job.archivedAt) {
      return res.status(404).json({
        error: 'Việc làm không tồn tại hoặc không còn mở tuyển dụng.',
        code: 'JOB_NOT_FOUND',
      });
    }

    const existing = await SavedJob.findOne({ userId: req.user._id, jobId });
    if (existing) {
      await SavedJob.deleteOne({ _id: existing._id });
      return res.json({ saved: false, jobId });
    } else {
      await SavedJob.create({ userId: req.user._id, jobId });
      return res.json({ saved: true, jobId });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/saved-jobs/:jobId (Contract: { saved: true, jobId })
router.post('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Mã việc làm không hợp lệ.', code: 'INVALID_ID' });
    }

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'approved' || job.archivedAt) {
      return res.status(404).json({
        error: 'Việc làm không tồn tại hoặc không còn mở tuyển dụng.',
        code: 'JOB_NOT_FOUND',
      });
    }

    await SavedJob.findOneAndUpdate(
      { userId: req.user._id, jobId },
      { userId: req.user._id, jobId },
      { upsert: true, new: true }
    );

    res.status(201).json({ saved: true, jobId });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/saved-jobs/:jobId (Contract: { saved: false, jobId })
router.delete('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    await SavedJob.findOneAndDelete({ userId: req.user._id, jobId });
    res.json({ saved: false, jobId });
  } catch (err) {
    next(err);
  }
});

export default router;
