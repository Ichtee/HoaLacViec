import express from 'express';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';

const router = express.Router();

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const { studentId, employerId, storeId, storeName, jobId, status } = req.query;
    const filter = {};

    if (studentId) filter.studentId = studentId;
    if (jobId) filter.jobId = jobId;

    const empId = employerId || storeId;
    if (empId || storeName) {
      let profileEmpId = null;
      let profileStoreName = null;
      if (empId) {
        try {
          const prof = await EmployerProfile.findOne({ userId: empId });
          if (prof) {
            profileEmpId = prof._id;
            profileStoreName = prof.storeName;
          }
        } catch (e) {}
      }

      // Find jobs associated with this employer or store name
      const jobFilters = [];
      if (empId) jobFilters.push({ employerId: empId });
      if (profileEmpId) jobFilters.push({ employerId: profileEmpId });
      if (storeName) jobFilters.push({ storeName: { $regex: new RegExp(`^${storeName}$`, 'i') } });
      if (profileStoreName) jobFilters.push({ storeName: { $regex: new RegExp(`^${profileStoreName}$`, 'i') } });

      const employerJobs = await Job.find({ $or: jobFilters }).select('_id');
      const jobIds = employerJobs.map(j => j._id);

      const orMatches = [{ jobId: { $in: jobIds } }];
      if (empId) orMatches.push({ employerId: empId });
      if (profileEmpId) orMatches.push({ employerId: profileEmpId });

      filter.$or = orMatches;
    }

    if (status) {
      if (status === 'approved' || status === 'accepted') {
        filter.status = { $in: ['approved', 'accepted'] };
      } else {
        filter.status = status;
      }
    }

    const applications = await Application.find(filter)
      .populate('jobId')
      .sort({ createdAt: -1 });

    const formatted = applications.map(app => {
      const a = app.toObject ? app.toObject() : app;
      const job = a.jobId || {};
      return {
        ...a,
        id: a._id,
        jobTitle: job.title || a.jobTitle || 'Nhân viên bán thời gian',
        storeName: job.storeName || a.storeName || 'Cửa hàng Hòa Lạc',
        location: job.address || a.location || 'Hòa Lạc, Thạch Thất',
        appliedAt: a.createdAt ? new Date(a.createdAt).toLocaleDateString('vi-VN') : 'Gần đây',
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications (Sinh viên nộp đơn)
router.post('/', async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      studentPhone,
      studentEmail,
      jobId,
      note,
      name,
      phone,
      email,
      coverLetter,
      shift,
    } = req.body;
    if (!studentId || !jobId) {
      return res.status(400).json({ error: 'Thiếu thông tin ứng tuyển' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm' });

    // Check duplicate
    const existing = await Application.findOne({
      studentId,
      jobId,
      status: { $in: ['pending', 'accepted', 'approved'] },
    });
    if (existing) {
      return res.status(400).json({ error: 'Bạn đã nộp đơn cho vị trí này rồi.' });
    }

    const finalName = studentName || name || 'Sinh viên';
    const finalPhone = studentPhone || phone || '';
    const finalEmail = studentEmail || email || '';
    const finalNote = note || [shift ? `[Ca mong muốn: ${shift}]` : '', coverLetter || ''].filter(Boolean).join(' ');

    const application = await Application.create({
      studentId,
      studentName: finalName,
      studentPhone: finalPhone,
      studentEmail: finalEmail,
      jobId,
      employerId: job.employerId || null,
      note: finalNote,
      status: 'pending',
    });

    const populated = await Application.findById(application._id).populate('jobId');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/applications/:id (Cập nhật trạng thái duyệt/từ chối/rút đơn)
router.put('/:id', async (req, res) => {
  try {
    const { status, note, employerNote } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (note !== undefined) updateData.employerNote = note;
    if (employerNote !== undefined) updateData.employerNote = employerNote;

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('jobId');

    res.json(application);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/applications/:id/withdraw (Sinh viên rút đơn)
router.put('/:id/withdraw', async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status: 'withdrawn' },
      { new: true }
    );
    res.json({ message: 'Rút đơn ứng tuyển thành công', application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa đơn ứng tuyển' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
