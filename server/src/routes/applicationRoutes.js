import express from 'express';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Require authentication for all application actions
router.use(authenticate);

// Helper: Vietnamese label for application status
function getStatusLabel(status) {
  const map = {
    pending: 'Đang chờ xét duyệt',
    reviewing: 'Đang xem xét hồ sơ',
    shortlisted: 'Đạt tiêu chuẩn vòng sơ loại',
    interview: 'Hẹn phỏng vấn',
    hired: 'Trúng tuyển',
    accepted: 'Đã nhận việc',
    approved: 'Đã được duyệt',
    rejected: 'Chưa phù hợp',
    withdrawn: 'Đã rút đơn',
  };
  return map[status] || status;
}

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const { studentId, employerId, storeId, storeName, jobId, status } = req.query;
    const filter = {};

    // Role-based scoping
    if (req.user.role === 'student') {
      // Students can ONLY view their own applications
      filter.studentId = req.user._id;
    } else if (req.user.role === 'employer') {
      // Employers can ONLY view applications for their jobs
      const employerProfile = await EmployerProfile.findOne({ userId: req.user._id });
      const empOrConditions = [
        { employerId: req.user._id },
        { employerUserId: req.user._id },
      ];
      if (employerProfile) {
        empOrConditions.push({ employerId: employerProfile._id });
        empOrConditions.push({ employerProfileId: employerProfile._id });
        if (employerProfile.storeName) {
          empOrConditions.push({ storeName: { $regex: new RegExp(`^${employerProfile.storeName}$`, 'i') } });
        }
      }
      const myJobs = await Job.find({ $or: empOrConditions }).select('_id');
      const myJobIds = myJobs.map(j => j._id);

      filter.$or = [
        { jobId: { $in: myJobIds } },
        { employerId: req.user._id },
        ...(employerProfile ? [{ employerId: employerProfile._id }] : [])
      ];
    } else if (req.user.role === 'admin') {
      if (studentId) filter.studentId = studentId;
      if (employerId || storeId) filter.employerId = employerId || storeId;
    }

    if (jobId) filter.jobId = jobId;

    if (status) {
      if (status === 'approved' || status === 'accepted' || status === 'hired') {
        filter.status = { $in: ['approved', 'accepted', 'hired'] };
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
    if (req.user.role !== 'student' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ tài khoản sinh viên mới có thể nộp đơn ứng tuyển.' });
    }

    const {
      jobId,
      note,
      name,
      phone,
      email,
      studentName,
      studentPhone,
      studentEmail,
      coverLetter,
      shift,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'Thiếu thông tin việc làm cần ứng tuyển.' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy việc làm.' });

    const studentId = req.user._id;

    // Check duplicate with 409 Conflict policy
    const existing = await Application.findOne({
      studentId,
      jobId,
      status: { $in: ['pending', 'reviewing', 'shortlisted', 'interview', 'hired', 'accepted', 'approved'] },
    });
    if (existing) {
      return res.status(409).json({ error: 'Bạn đã nộp đơn cho vị trí này rồi. Vui lòng kiểm tra mục Đơn ứng tuyển của bạn.' });
    }

    const finalName = studentName || name || req.user.name || 'Sinh viên';
    const finalPhone = studentPhone || phone || req.user.phone || '';
    const finalEmail = studentEmail || email || req.user.email || '';
    const finalNote = note || [shift ? `[Ca mong muốn: ${shift}]` : '', coverLetter || ''].filter(Boolean).join(' ');

    const application = await Application.create({
      studentId,
      studentName: finalName,
      studentPhone: finalPhone,
      studentEmail: finalEmail,
      jobId,
      employerId: job.employerUserId || job.employerId || null,
      note: finalNote,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        changedAt: new Date(),
        changedBy: req.user._id,
        note: 'Sinh viên nộp đơn ứng tuyển',
      }],
    });

    // Send in-app notification to employer
    const targetEmployerUser = job.employerUserId || job.employerId;
    if (targetEmployerUser) {
      try {
        await Notification.create({
          userId: targetEmployerUser,
          title: 'Ứng viên mới nộp đơn! 🎉',
          message: `${finalName} vừa nộp đơn ứng tuyển vị trí "${job.title}".`,
          type: 'application',
          link: '/employer/applications',
        });
      } catch (notifErr) {
        console.warn('Failed to dispatch employer notification:', notifErr.message);
      }
    }

    const populated = await Application.findById(application._id).populate('jobId');
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Bạn đã nộp đơn cho vị trí này rồi.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/applications/:id (Cập nhật trạng thái duyệt/phỏng vấn/từ chối)
router.put('/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.' });
    }

    // Only employer owner of the job or admin can change status
    if (req.user.role !== 'admin') {
      const employerProfile = await EmployerProfile.findOne({ userId: req.user._id });
      const allowedEmployerIds = [req.user._id.toString()];
      if (employerProfile) allowedEmployerIds.push(employerProfile._id.toString());

      const isOwner = application.employerId && allowedEmployerIds.includes(application.employerId.toString());
      if (!isOwner) {
        const job = await Job.findById(application.jobId);
        const isJobOwner = job && (
          (job.employerUserId && allowedEmployerIds.includes(job.employerUserId.toString())) ||
          (job.employerId && allowedEmployerIds.includes(job.employerId.toString()))
        );
        if (!isJobOwner) {
          return res.status(403).json({ error: 'Bạn không có quyền cập nhật đơn ứng tuyển này.' });
        }
      }
    }

    const { status, note, employerNote, internalNote, candidateFeedback, interviewSchedule } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (note !== undefined) updateData.employerNote = note;
    if (employerNote !== undefined) updateData.employerNote = employerNote;
    if (internalNote !== undefined) updateData.internalNote = internalNote;
    if (candidateFeedback !== undefined) updateData.candidateFeedback = candidateFeedback;
    if (interviewSchedule !== undefined) updateData.interviewSchedule = interviewSchedule;

    // Track status history
    if (status && status !== application.status) {
      const historyEntry = {
        status,
        changedAt: new Date(),
        changedBy: req.user._id,
        note: candidateFeedback || internalNote || note || `Chuyển trạng thái sang ${getStatusLabel(status)}`,
      };
      updateData.$push = { statusHistory: historyEntry };
    }

    const updated = await Application.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('jobId');

    // Send in-app notification to student about status change
    if (status && status !== application.status) {
      try {
        const job = updated.jobId || {};
        let notifTitle = 'Cập nhật trạng thái đơn ứng tuyển';
        let notifMsg = `Đơn ứng tuyển vị trí "${job.title || 'công việc'}" của bạn đã được cập nhật: ${getStatusLabel(status)}.`;

        if (status === 'interview') {
          notifTitle = 'Lời mời phỏng vấn! 📅';
          notifMsg = `Cửa hàng ${job.storeName || ''} đã mời bạn tham gia phỏng vấn vị trí "${job.title}". Vui lòng kiểm tra chi tiết đơn ứng tuyển.`;
        } else if (status === 'hired' || status === 'accepted' || status === 'approved') {
          notifTitle = 'Chúc mừng! Bạn đã trúng tuyển 🎉';
          notifMsg = `Cửa hàng ${job.storeName || ''} đã tiếp nhận bạn vào làm việc cho vị trí "${job.title}".`;
        } else if (status === 'rejected') {
          notifTitle = 'Thông báo kết quả ứng tuyển';
          notifMsg = `Hồ sơ của bạn cho vị trí "${job.title}" tại ${job.storeName || 'quán'} chưa phù hợp ở thời điểm hiện tại.`;
        }

        await Notification.create({
          userId: application.studentId,
          title: notifTitle,
          message: notifMsg,
          type: 'application',
          link: '/student/applications',
        });
      } catch (notifErr) {
        console.warn('Failed to notify student:', notifErr.message);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/applications/:id/withdraw (Sinh viên rút đơn)
router.put('/:id/withdraw', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.' });
    }

    // Only the student who submitted the application or admin can withdraw
    if (req.user.role !== 'admin' && application.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền rút đơn ứng tuyển của người khác.' });
    }

    application.status = 'withdrawn';
    application.statusHistory.push({
      status: 'withdrawn',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Sinh viên chủ động rút đơn ứng tuyển',
    });
    await application.save();

    res.json({ message: 'Rút đơn ứng tuyển thành công', application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.' });
    }

    // Only admin or the student owner can delete
    if (req.user.role !== 'admin' && application.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa đơn ứng tuyển này.' });
    }

    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa đơn ứng tuyển' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
