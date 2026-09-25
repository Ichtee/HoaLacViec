import express from 'express';
import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// State machine definition
const VALID_TRANSITIONS = {
  pending: ['reviewing', 'withdrawn'],
  reviewing: ['shortlisted', 'interview', 'rejected', 'withdrawn'],
  shortlisted: ['interview', 'hired', 'rejected', 'withdrawn'],
  interview: ['hired', 'rejected', 'withdrawn'],
  // Terminal states (no transitions allowed)
  hired: [],
  rejected: [],
  withdrawn: [],
  accepted: [], // legacy alias for hired
  approved: [], // legacy alias for hired
};

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
router.get('/', async (req, res, next) => {
  try {
    const { studentId, employerId, storeId, jobId, status } = req.query;
    const filter = {};

    // Role-based scoping
    if (req.user.role === 'student') {
      filter.studentId = req.user._id;
    } else if (req.user.role === 'employer') {
      const employerProfile = await EmployerProfile.findOne({ userId: req.user._id });
      const empOrConditions = [
        { employerId: req.user._id },
        { employerUserId: req.user._id },
      ];
      if (employerProfile) {
        empOrConditions.push({ employerId: employerProfile._id });
        empOrConditions.push({ employerProfileId: employerProfile._id });
      }
      const myJobs = await Job.find({ $or: empOrConditions }).select('_id');
      const myJobIds = myJobs.map(j => j._id);

      filter.$or = [
        { jobId: { $in: myJobIds } },
        { employerId: req.user._id },
        ...(employerProfile ? [{ employerId: employerProfile._id }] : []),
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
    next(err);
  }
});

// POST /api/applications (Active student apply to approved, unexpired, non-full job)
router.post('/', async (req, res, next) => {
  try {
    // Only active student accounts can apply
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'student' || req.user.status !== 'active') {
        return res.status(403).json({
          error: 'Chỉ tài khoản sinh viên đã xác minh và đang hoạt động mới có thể nộp đơn ứng tuyển.',
          code: 'FORBIDDEN',
        });
      }
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

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Mã việc làm không hợp lệ.', code: 'INVALID_ID' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'JOB_NOT_FOUND' });
    }

    // Only apply to approved, non-archived, unexpired jobs with slots
    if (job.status !== 'approved' || job.archivedAt) {
      return res.status(400).json({
        error: 'Công việc này hiện không còn mở tiếp nhận hồ sơ.',
        code: 'JOB_CLOSED',
      });
    }

    if (job.closesAt && new Date(job.closesAt) <= new Date()) {
      return res.status(400).json({
        error: 'Công việc này đã hết thời hạn ứng tuyển.',
        code: 'JOB_EXPIRED',
      });
    }

    if (typeof job.slots === 'number' && job.slots <= 0) {
      return res.status(400).json({
        error: 'Công việc này đã tuyển đủ số lượng (hết slot trống).',
        code: 'JOB_SLOTS_FULL',
      });
    }

    const studentId = req.user._id;

    // MVP: Exactly 1 application per student per job
    const existing = await Application.findOne({ studentId, jobId });
    if (existing) {
      return res.status(409).json({
        error: 'Bạn đã nộp đơn cho vị trí này rồi. Mỗi ứng viên chỉ được có một hồ sơ ứng tuyển duy nhất cho mỗi công việc.',
        code: 'DUPLICATE_APPLICATION',
      });
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

    // Notify employer
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
      return res.status(409).json({
        error: 'Bạn đã có hồ sơ ứng tuyển cho công việc này.',
        code: 'DUPLICATE_APPLICATION',
      });
    }
    next(err);
  }
});

// PUT /api/applications/:id (Update status with state machine enforcement)
router.put('/:id', async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.', code: 'NOT_FOUND' });
    }

    // Role ownership check
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
          return res.status(403).json({ error: 'Bạn không có quyền cập nhật đơn ứng tuyển này.', code: 'FORBIDDEN' });
        }
      }
    }

    const { status, note, employerNote, internalNote, candidateFeedback, interviewSchedule } = req.body;

    // State machine check
    if (status && status !== application.status) {
      const allowedNext = VALID_TRANSITIONS[application.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(409).json({
          error: `Không thể chuyển trạng thái từ "${application.status}" sang "${status}". Các trạng thái hợp lệ: ${allowedNext.join(', ') || 'Không có (trạng thái kết thúc)'}.`,
          code: 'INVALID_TRANSITION',
        });
      }

      // If transitioning to hired, atomically reserve slot
      if (status === 'hired') {
        const updatedJob = await Job.findOneAndUpdate(
          { _id: application.jobId, slots: { $gt: 0 } },
          { $inc: { slots: -1 } },
          { new: true }
        );

        if (!updatedJob) {
          return res.status(409).json({
            error: 'Công việc này đã đủ chỉ tiêu tuyển dụng (hết slot trống).',
            code: 'NO_SLOTS_AVAILABLE',
          });
        }

        if (updatedJob.slots === 0) {
          updatedJob.status = 'closed';
          await updatedJob.save();
        }
      }
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (note !== undefined) updateData.employerNote = note;
    if (employerNote !== undefined) updateData.employerNote = employerNote;
    if (internalNote !== undefined) updateData.internalNote = internalNote;
    if (candidateFeedback !== undefined) updateData.candidateFeedback = candidateFeedback;
    if (interviewSchedule !== undefined) updateData.interviewSchedule = interviewSchedule;

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

    // Notify student
    if (status && status !== application.status) {
      try {
        const job = updated.jobId || {};
        let notifTitle = 'Cập nhật trạng thái đơn ứng tuyển';
        let notifMsg = `Đơn ứng tuyển vị trí "${job.title || 'công việc'}" của bạn đã được cập nhật: ${getStatusLabel(status)}.`;

        if (status === 'interview') {
          notifTitle = 'Lời mời phỏng vấn! 📅';
          notifMsg = `Cửa hàng ${job.storeName || ''} đã mời bạn tham gia phỏng vấn vị trí "${job.title}". Vui lòng kiểm tra chi tiết đơn ứng tuyển.`;
        } else if (status === 'hired') {
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
    next(err);
  }
});

// PUT /api/applications/:id/withdraw (Student withdraw before terminal state)
router.put('/:id/withdraw', async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin' && application.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền rút đơn ứng tuyển của người khác.', code: 'FORBIDDEN' });
    }

    const terminalStates = ['hired', 'rejected', 'withdrawn', 'accepted', 'approved'];
    if (terminalStates.includes(application.status)) {
      return res.status(409).json({
        error: `Không thể rút đơn khi đơn đã ở trạng thái kết thúc (${getStatusLabel(application.status)}).`,
        code: 'TERMINAL_STATE',
      });
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
    next(err);
  }
});

// DELETE /api/applications/:id (Applications cannot be hard deleted; preserve audit trail)
router.delete('/:id', async (req, res) => {
  return res.status(400).json({
    error: 'Hồ sơ ứng tuyển không thể bị xóa để đảm bảo tính minh bạch và lịch sử kiểm toán của hệ thống.',
    code: 'CANNOT_DELETE',
  });
});

export default router;
export {
  VALID_TRANSITIONS,
  getStatusLabel,
};
