import express from 'express';
import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';
import { LABOR_ROLES, toApplicationDTO } from '../utils/applicationDto.js';
import {
  VALID_TRANSITIONS,
  getStatusLabel,
  sendOffer,
  rescindOffer,
  studentAcceptOffer,
  studentDeclineOffer,
  assertEmployerOwnership,
} from '../services/applicationService.js';

const router = express.Router();
router.use(authenticate);

// GET /api/applications
router.get('/', async (req, res, next) => {
  try {
    const { studentId, employerId, storeId, jobId, status } = req.query;
    const filter = {};

    // Role-based scoping
    const isEmployee = LABOR_ROLES.includes(req.user.role);
    if (isEmployee) {
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
        { employerUserId: req.user._id },
        ...(employerProfile ? [{ employerId: employerProfile._id }] : []),
      ];
    } else if (req.user.role === 'admin') {
      if (studentId) filter.studentId = studentId;
      if (employerId || storeId) filter.employerId = employerId || storeId;
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập.', code: 'FORBIDDEN' });
    }

    if (jobId) filter.jobId = jobId;

    if (status) {
      if (status === 'approved' || status === 'accepted' || status === 'hired') {
        filter.status = { $in: ['approved', 'accepted', 'hired'] };
      } else if (status === 'pending' || status === 'submitted') {
        filter.status = { $in: ['pending', 'submitted'] };
      } else if (status === 'reviewing' || status === 'screening') {
        filter.status = { $in: ['reviewing', 'screening'] };
      } else {
        filter.status = status;
      }
    }

    const applications = await Application.find(filter)
      .populate('jobId')
      .sort({ createdAt: -1 });

    const formatted = applications.map(app => {
      const a = toApplicationDTO(app, req.user.role);
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

// GET /api/applications/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã hồ sơ không hợp lệ.', code: 'INVALID_ID' });
    }

    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('studentId', 'name phone email avatar studentProfile')
      .lean();

    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng tuyển.', code: 'NOT_FOUND' });
    }

    // Role check & scoping
    const isEmployee = LABOR_ROLES.includes(req.user.role);
    if (isEmployee) {
      const applicantId = application.studentId?._id?.toString() || application.studentId?.toString();
      if (applicantId !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Bạn không có quyền xem hồ sơ này.', code: 'FORBIDDEN' });
      }
    } else if (req.user.role === 'employer') {
      await assertEmployerOwnership(application, req.user._id);
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền truy cập.', code: 'FORBIDDEN' });
    }

    res.json({ ...toApplicationDTO(application, req.user.role), id: application._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications (Active candidate apply)
router.post('/', async (req, res, next) => {
  try {
    const isLaborRole = LABOR_ROLES.includes(req.user.role);
    if (req.user.role !== 'admin' && (!isLaborRole || req.user.status !== 'active')) {
      return res.status(403).json({
        error: 'Chỉ tài khoản người tìm việc đã xác minh và đang hoạt động mới có thể nộp đơn ứng tuyển.',
        code: 'FORBIDDEN',
      });
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
      selectedPosition,
      selectedShift,
    } = req.body;

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Mã việc làm không hợp lệ.', code: 'INVALID_ID' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm.', code: 'NOT_FOUND' });
    }

    // Ensure job is open
    if (job.status !== 'approved' || job.archivedAt) {
      return res.status(400).json({
        error: 'Công việc này hiện không tiếp nhận hồ sơ ứng tuyển.',
        code: 'JOB_NOT_ACCEPTING',
      });
    }

    if (job.recruitmentStatus === 'filled' || job.remainingOpenings <= 0 || (typeof job.slots === 'number' && job.slots <= 0)) {
      return res.status(400).json({
        error: 'Công việc này đã đủ số lượng nhân viên cần tuyển.',
        code: 'JOB_FULL',
      });
    }

    // Check duplicate
    const existing = await Application.findOne({ studentId: req.user._id, jobId, isActive: { $ne: false } });
    if (existing) {
      return res.status(409).json({
        error: 'Bạn đã nộp đơn cho công việc này rồi. Vui lòng theo dõi trạng thái tại mục Đơn ứng tuyển.',
        code: 'DUPLICATE_APPLICATION',
      });
    }

    const studentFullName = studentName || name || req.user.name || 'Sinh viên';
    const studentContactPhone = studentPhone || phone || req.user.phone || '';
    const studentContactEmail = studentEmail || email || req.user.email || '';

    const newApp = await Application.create({
      studentId: req.user._id,
      studentName: studentFullName,
      studentPhone: studentContactPhone,
      studentEmail: studentContactEmail,
      jobId,
      employerId: job.employerId || job.employerUserId,
      employerUserId: job.employerUserId || job.employerId,
      status: 'submitted',
      selectedPosition: selectedPosition || '',
      selectedShift: selectedShift || '',
      note: note || '',
      statusHistory: [{
        fromStatus: '',
        toStatus: 'submitted',
        status: 'submitted',
        changedAt: new Date(),
        changedBy: req.user._id,
        reason: 'Nộp hồ sơ ứng tuyển',
        candidateVisibleMessage: 'Bạn đã nộp hồ sơ thành công.',
      }],
    });

    // Notify employer
    try {
      const targetEmployer = job.employerUserId || job.employerId;
      if (targetEmployer) {
        await Notification.create({
          userId: targetEmployer,
          title: 'Hồ sơ ứng tuyển mới! 📄',
          message: `${studentFullName} vừa nộp hồ sơ cho vị trí "${job.title}".`,
          type: 'application',
          link: '/employer/applications',
        });
      }
    } catch (notifErr) {
      console.warn('Notification error on application submit:', notifErr.message);
    }

    res.status(201).json({
      message: 'Nộp đơn ứng tuyển thành công! Nhà tuyển dụng sẽ xem xét và phản hồi sớm.',
      application: { ...newApp.toObject(), id: newApp._id },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/offer (Employer sends offer)
router.post('/:id/offer', async (req, res, next) => {
  try {
    const updated = await sendOffer(req.params.id, req.user._id, req.body);
    res.json({ message: 'Đã gửi đề nghị nhận việc (Job Offer) thành công cho ứng viên.', application: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/rescind-offer (Employer rescinds offer)
router.post('/:id/rescind-offer', async (req, res, next) => {
  try {
    const updated = await rescindOffer(req.params.id, req.user._id, req.body.reason);
    res.json({ message: 'Đã thu hồi đề nghị nhận việc thành công.', application: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/accept-offer (Student accepts offer -> Finalize hire)
router.post('/:id/accept-offer', async (req, res, next) => {
  try {
    const { application, employment } = await studentAcceptOffer(req.params.id, req.user._id, req.body.responseNote);
    res.json({
      message: 'Chúc mừng bạn đã chấp nhận đề nghị nhận việc và chính thức trở thành nhân viên! 🎉',
      application,
      employment,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/decline-offer (Student declines offer)
router.post('/:id/decline-offer', async (req, res, next) => {
  try {
    const application = await studentDeclineOffer(req.params.id, req.user._id, req.body.reason);
    res.json({ message: 'Bạn đã từ chối đề nghị nhận việc.', application });
  } catch (err) {
    next(err);
  }
});

// PUT /api/applications/:id (Update status / screening / shortlist / interview)
router.put('/:id', async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng tuyển.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin') {
      await assertEmployerOwnership(application, req.user._id);
    }

    const { status, note, internalNote, candidateFeedback, interviewSchedule } = req.body;

    if (status && status !== application.status) {
      // FORBIDDEN: Employer cannot self-mark offer_accepted or hired directly
      if (status === 'offer_accepted') {
        return res.status(403).json({
          error: 'Nhà tuyển dụng không thể tự ý đánh dấu "Đã chấp nhận đề nghị" thay cho ứng viên.',
          code: 'FORBIDDEN_SELF_ACCEPT',
        });
      }

      if (status === 'hired') {
        return res.status(400).json({
          error: 'Không thể duyệt trúng tuyển (hired) trực tiếp. Bạn cần gửi Đề nghị nhận việc (Offer) và ứng viên phải đồng ý trước khi hoàn tất tuyển dụng.',
          code: 'MUST_ACCEPT_OFFER_FIRST',
        });
      }

      const allowedNext = VALID_TRANSITIONS[application.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(409).json({
          error: `Không thể chuyển trạng thái từ "${getStatusLabel(application.status)}" sang "${getStatusLabel(status)}". Các trạng thái hợp lệ tiếp theo: ${allowedNext.map(getStatusLabel).join(', ') || 'Không có'}.`,
          code: 'INVALID_TRANSITION',
        });
      }
    }

    const oldStatus = application.status;
    if (status) application.status = status;
    if (internalNote !== undefined) application.internalNote = internalNote;
    if (candidateFeedback !== undefined) application.candidateFeedback = candidateFeedback;
    if (note !== undefined) application.candidateFeedback = note;

    if (interviewSchedule !== undefined) {
      application.interviewSchedule = {
        ...application.interviewSchedule,
        ...interviewSchedule,
      };
    }

    if (status && status !== oldStatus) {
      application.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: status,
        status: status,
        changedAt: new Date(),
        changedBy: req.user._id,
        reason: internalNote || `Chuyển trạng thái sang ${getStatusLabel(status)}`,
        candidateVisibleMessage: candidateFeedback || `Hồ sơ của bạn đã được chuyển sang: ${getStatusLabel(status)}`,
      });
    }

    await application.save();

    // Notify student if status changed
    if (status && status !== oldStatus) {
      try {
        let notifTitle = 'Cập nhật trạng thái hồ sơ ứng tuyển';
        let notifMsg = `Hồ sơ của bạn đã được cập nhật: ${getStatusLabel(status)}.`;

        if (status === 'interview') {
          notifTitle = 'Lời mời phỏng vấn! 📅';
          notifMsg = `Nhà tuyển dụng đã mời bạn tham gia phỏng vấn. Vui lòng kiểm tra chi tiết trong hồ sơ ứng tuyển.`;
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

    res.json(application);
  } catch (err) {
    next(err);
  }
});

// PUT /api/applications/:id/withdraw (Student withdraws before offer_accepted)
router.put('/:id/withdraw', async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin' && application.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền rút hồ sơ của người khác.', code: 'FORBIDDEN' });
    }

    const terminalStates = ['offer_accepted', 'hired', 'rejected', 'withdrawn', 'offer_declined'];
    if (terminalStates.includes(application.status)) {
      return res.status(409).json({
        error: `Không thể rút đơn khi hồ sơ đã ở trạng thái kết thúc (${getStatusLabel(application.status)}).`,
        code: 'TERMINAL_STATE',
      });
    }

    const oldStatus = application.status;
    application.status = 'withdrawn';
    application.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: 'withdrawn',
      status: 'withdrawn',
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: req.body.reason || 'Sinh viên chủ động rút đơn ứng tuyển',
      candidateVisibleMessage: 'Bạn đã rút đơn ứng tuyển này.',
    });
    await application.save();

    res.json({ message: 'Rút đơn ứng tuyển thành công', application });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/applications/:id (Soft rejection / rejection instead of hard delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ.', code: 'NOT_FOUND' });
    }

    if (req.user.role !== 'admin') {
      await assertEmployerOwnership(application, req.user._id);
    }

    if (!VALID_TRANSITIONS[application.status]?.includes('rejected')) {
      return res.status(409).json({
        error: 'Hồ sơ ở trạng thái này không thể chuyển sang từ chối. Hãy sử dụng đúng luồng đề nghị nhận việc hoặc quản lý nhân viên.',
        code: 'INVALID_TRANSITION',
      });
    }

    // Soft delete: mark as rejected with note rather than destroying audit trail
    const fromStatus = application.status; // capture before overwriting
    application.status = 'rejected';
    application.internalNote = 'Đã gỡ hồ sơ khỏi danh sách ứng viên tuyển dụng';
    application.statusHistory.push({
      fromStatus: fromStatus,
      toStatus: 'rejected',
      status: 'rejected',
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: 'Nhà tuyển dụng loại hồ sơ khỏi danh sách',
      candidateVisibleMessage: 'Hồ sơ đã được lưu trữ.',
    });
    await application.save();

    res.json({ message: 'Đã gỡ hồ sơ khỏi danh sách thành công', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
export { VALID_TRANSITIONS, getStatusLabel };
