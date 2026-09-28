import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Employment } from '../models/Employment.js';
import { Notification } from '../models/Notification.js';

export const VALID_TRANSITIONS = {
  submitted: ['screening', 'shortlisted', 'interview', 'offer_sent', 'rejected', 'withdrawn'],
  screening: ['shortlisted', 'interview', 'offer_sent', 'rejected', 'withdrawn'],
  shortlisted: ['interview', 'offer_sent', 'rejected', 'withdrawn'],
  interview: ['offer_sent', 'rejected', 'withdrawn'],
  offer_sent: ['offer_accepted', 'offer_declined', 'offer_expired', 'offer_rescinded', 'withdrawn'],
  offer_accepted: ['hired', 'withdrawn'],
  hired: [], // Terminal recruitment state (employee management moves to Employment model)

  // Terminal exit states
  rejected: ['screening'], // Can be reconsidered if employer wants
  withdrawn: [],
  offer_declined: [],
  offer_expired: ['offer_sent'], // Employer can re-send expired offer
  offer_rescinded: ['screening'],

  // Legacy mappings
  pending: ['screening', 'shortlisted', 'interview', 'offer_sent', 'rejected', 'withdrawn'],
  reviewing: ['shortlisted', 'interview', 'offer_sent', 'rejected', 'withdrawn'],
  accepted: [],
  approved: [],
};

export function getStatusLabel(status) {
  const map = {
    submitted: 'Mới nộp hồ sơ',
    screening: 'Đang sàng lọc hồ sơ',
    shortlisted: 'Lọt vòng sơ loại',
    interview: 'Hẹn phỏng vấn',
    offer_sent: 'Đã gửi đề nghị nhận việc',
    offer_accepted: 'Đã chấp nhận đề nghị',
    hired: 'Đã tuyển dụng thành công',
    rejected: 'Chưa phù hợp',
    withdrawn: 'Đã rút hồ sơ',
    offer_declined: 'Đã từ chối đề nghị',
    offer_expired: 'Đề nghị hết hạn',
    offer_rescinded: 'Đã thu hồi đề nghị',
    // Legacy
    pending: 'Mới nộp hồ sơ',
    reviewing: 'Đang sàng lọc hồ sơ',
    accepted: 'Đã nhận việc',
    approved: 'Đã trúng tuyển',
  };
  return map[status] || status;
}

/**
 * Check if the actor has permission to manage this application
 */
export async function assertEmployerOwnership(application, actorUserId) {
  const employerProfile = await EmployerProfile.findOne({ userId: actorUserId });
  const allowedEmployerIds = [actorUserId.toString()];
  if (employerProfile) allowedEmployerIds.push(employerProfile._id.toString());

  if (application.employerUserId && allowedEmployerIds.includes(application.employerUserId.toString())) {
    return true;
  }
  if (application.employerId && allowedEmployerIds.includes(application.employerId.toString())) {
    return true;
  }

  // Check job ownership
  const job = await Job.findById(application.jobId);
  if (job) {
    if (job.employerUserId && allowedEmployerIds.includes(job.employerUserId.toString())) return true;
    if (job.employerId && allowedEmployerIds.includes(job.employerId.toString())) return true;
  }

  const err = new Error('Bạn không có quyền quản lý hồ sơ ứng tuyển này.');
  err.code = 'FORBIDDEN';
  err.status = 403;
  throw err;
}

/**
 * Send an offer to candidate
 */
export async function sendOffer(applicationId, employerUserId, offerData) {
  const application = await Application.findById(applicationId).populate('jobId');
  if (!application) {
    const err = new Error('Không tìm thấy hồ sơ ứng tuyển.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  await assertEmployerOwnership(application, employerUserId);

  const allowedNext = VALID_TRANSITIONS[application.status] || [];
  if (!allowedNext.includes('offer_sent')) {
    const err = new Error(`Không thể gửi offer khi hồ sơ đang ở trạng thái "${getStatusLabel(application.status)}".`);
    err.code = 'INVALID_TRANSITION';
    err.status = 409;
    throw err;
  }

  const job = application.jobId || {};
  const snapshot = {
    position: offerData.position || application.selectedPosition || job.title || 'Nhân viên bán ca',
    workplace: offerData.workplace || job.storeName || 'Cửa hàng',
    wage: Number(offerData.wage) || job.salaryAmount || 25000,
    wageUnit: offerData.wageUnit || job.salaryUnit || 'hour',
    currency: 'VND',
    expectedSchedule: offerData.expectedSchedule || application.selectedShift || job.shiftDetail || '',
    proposedStartDate: offerData.proposedStartDate ? new Date(offerData.proposedStartDate) : null,
    expiryDate: offerData.expiryDays
      ? new Date(Date.now() + Number(offerData.expiryDays) * 24 * 60 * 60 * 1000)
      : (offerData.expiryDate ? new Date(offerData.expiryDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
    note: offerData.note || '',
    status: 'sent',
    sentAt: new Date(),
    respondedAt: null,
    responseNote: '',
  };

  const oldStatus = application.status;
  application.status = 'offer_sent';
  application.offer = snapshot;
  if (offerData.internalNote) application.internalNote = offerData.internalNote;
  if (offerData.candidateFeedback) application.candidateFeedback = offerData.candidateFeedback;

  application.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: 'offer_sent',
    status: 'offer_sent',
    changedAt: new Date(),
    changedBy: employerUserId,
    reason: offerData.internalNote || 'Gửi đề nghị nhận việc (Offer) cho ứng viên',
    candidateVisibleMessage: offerData.candidateFeedback || `Bạn nhận được lời mời nhận việc vị trí "${snapshot.position}".`,
  });

  await application.save();

  // Notify student
  try {
    await Notification.create({
      userId: application.studentId,
      title: 'Bạn nhận được đề nghị nhận việc (Job Offer)! 🎉',
      message: `Cửa hàng ${snapshot.workplace} đã gửi đề nghị nhận việc vị trí "${snapshot.position}". Vui lòng xem chi tiết và phản hồi trước ngày ${snapshot.expiryDate ? snapshot.expiryDate.toLocaleDateString('vi-VN') : ''}.`,
      type: 'application',
      link: '/student/applications',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student of offer:', notifErr.message);
  }

  return application;
}

/**
 * Rescind offer before accepted
 */
export async function rescindOffer(applicationId, employerUserId, reason) {
  const application = await Application.findById(applicationId);
  if (!application) {
    const err = new Error('Không tìm thấy hồ sơ ứng tuyển.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  await assertEmployerOwnership(application, employerUserId);

  if (application.status !== 'offer_sent') {
    const err = new Error('Chỉ có thể thu hồi offer khi offer đang ở trạng thái đã gửi (offer_sent).');
    err.code = 'INVALID_TRANSITION';
    err.status = 409;
    throw err;
  }

  const oldStatus = application.status;
  application.status = 'offer_rescinded';
  if (application.offer) {
    application.offer.status = 'rescinded';
    application.offer.respondedAt = new Date();
  }

  application.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: 'offer_rescinded',
    status: 'offer_rescinded',
    changedAt: new Date(),
    changedBy: employerUserId,
    reason: reason || 'Nhà tuyển dụng thu hồi đề nghị nhận việc',
    candidateVisibleMessage: 'Nhà tuyển dụng đã thu hồi đề nghị nhận việc.',
  });

  await application.save();

  // Notify student
  try {
    await Notification.create({
      userId: application.studentId,
      title: 'Đề nghị nhận việc đã được thu hồi',
      message: `Nhà tuyển dụng đã thu hồi đề nghị nhận việc đối với hồ sơ của bạn.`,
      type: 'application',
      link: '/student/applications',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student of offer rescinded:', notifErr.message);
  }

  return application;
}

/**
 * Student accepts offer - authoritatively enforced to belong to the student
 */
export async function studentAcceptOffer(applicationId, studentUserId, responseNote = '') {
  const application = await Application.findById(applicationId).populate('jobId');
  if (!application) {
    const err = new Error('Không tìm thấy hồ sơ ứng tuyển.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (application.studentId.toString() !== studentUserId.toString()) {
    const err = new Error('Bạn không có quyền chấp nhận đề nghị nhận việc của người khác.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  if (application.status !== 'offer_sent') {
    const err = new Error(`Không thể chấp nhận offer khi hồ sơ đang ở trạng thái "${getStatusLabel(application.status)}".`);
    err.code = 'INVALID_TRANSITION';
    err.status = 409;
    throw err;
  }

  // Check offer expiration
  if (application.offer?.expiryDate && new Date() > new Date(application.offer.expiryDate)) {
    application.status = 'offer_expired';
    if (application.offer) application.offer.status = 'expired';
    await application.save();

    const err = new Error('Đề nghị nhận việc này đã hết hạn phản hồi.');
    err.code = 'OFFER_EXPIRED';
    err.status = 410;
    throw err;
  }

  const oldStatus = application.status;
  application.status = 'offer_accepted';
  if (application.offer) {
    application.offer.status = 'accepted';
    application.offer.respondedAt = new Date();
    application.offer.responseNote = responseNote;
  }

  application.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: 'offer_accepted',
    status: 'offer_accepted',
    changedAt: new Date(),
    changedBy: studentUserId,
    reason: responseNote || 'Ứng viên đã chấp nhận đề nghị nhận việc (Offer Accepted)',
    candidateVisibleMessage: 'Bạn đã chấp nhận đề nghị nhận việc.',
  });

  await application.save();

  // Atomically finalize hire and create Employment
  const { employment } = await finalizeHire(application._id);

  return { application, employment };
}

/**
 * Student declines offer
 */
export async function studentDeclineOffer(applicationId, studentUserId, reason = '') {
  const application = await Application.findById(applicationId).populate('jobId');
  if (!application) {
    const err = new Error('Không tìm thấy hồ sơ ứng tuyển.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (application.studentId.toString() !== studentUserId.toString()) {
    const err = new Error('Bạn không có quyền từ chối đề nghị nhận việc của người khác.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  if (application.status !== 'offer_sent') {
    const err = new Error(`Không thể từ chối offer khi hồ sơ đang ở trạng thái "${getStatusLabel(application.status)}".`);
    err.code = 'INVALID_TRANSITION';
    err.status = 409;
    throw err;
  }

  const oldStatus = application.status;
  application.status = 'offer_declined';
  if (application.offer) {
    application.offer.status = 'declined';
    application.offer.respondedAt = new Date();
    application.offer.responseNote = reason;
  }

  application.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: 'offer_declined',
    status: 'offer_declined',
    changedAt: new Date(),
    changedBy: studentUserId,
    reason: reason || 'Ứng viên đã từ chối đề nghị nhận việc',
    candidateVisibleMessage: 'Bạn đã từ chối đề nghị nhận việc.',
  });

  await application.save();

  // Notify employer
  try {
    const employerTarget = application.employerUserId || application.employerId;
    if (employerTarget) {
      await Notification.create({
        userId: employerTarget,
        title: 'Ứng viên đã từ chối đề nghị nhận việc',
        message: `Ứng viên ${application.studentName} đã từ chối đề nghị nhận việc vị trí "${application.offer?.position || 'việc làm'}". Lý do: ${reason || 'Không có'}`,
        type: 'application',
        link: '/employer/applications',
      });
    }
  } catch (notifErr) {
    console.warn('Failed to notify employer of offer decline:', notifErr.message);
  }

  return application;
}

/**
 * Atomically finalize hire: transition application -> hired, create Employment, decrement capacity
 */
export async function finalizeHire(applicationId) {
  const application = await Application.findById(applicationId).populate('jobId');
  if (!application) {
    const err = new Error('Không tìm thấy hồ sơ ứng tuyển.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (application.status !== 'offer_accepted' && application.status !== 'hired') {
    const err = new Error('Chỉ có thể hoàn tất tuyển dụng (finalize hire) sau khi ứng viên đã chấp nhận offer (offer_accepted).');
    err.code = 'OFFER_NOT_ACCEPTED';
    err.status = 409;
    throw err;
  }

  // Idempotency check: did we already create Employment for this application?
  let existingEmployment = await Employment.findOne({ sourceApplicationId: application._id });
  if (existingEmployment) {
    return { application, employment: existingEmployment };
  }

  const job = application.jobId;
  const employerUserId = application.employerUserId || application.employerId || job.employerUserId || job.employerId;

  // Capacity check and atomic reservation on Job
  // Decrement remainingOpenings & increment hiredCount
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      $or: [
        { remainingOpenings: { $gt: 0 } },
        { slots: { $gt: 0 } },
      ],
    },
    {
      $inc: { hiredCount: 1, remainingOpenings: -1, slots: -1 },
    },
    { new: true }
  );

  if (!updatedJob) {
    const err = new Error('Công việc này đã tuyển đủ chỉ tiêu (hết chỗ trống).');
    err.code = 'NO_OPENINGS_AVAILABLE';
    err.status = 409;
    throw err;
  }

  // If fully filled, mark recruitmentStatus = 'filled'
  if (updatedJob.remainingOpenings <= 0) {
    updatedJob.remainingOpenings = 0;
    updatedJob.slots = 0;
    updatedJob.recruitmentStatus = 'filled';
    await updatedJob.save();
  }

  // Transition application to hired
  const oldStatus = application.status;
  application.status = 'hired';
  application.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: 'hired',
    status: 'hired',
    changedAt: new Date(),
    changedBy: employerUserId,
    reason: 'Hoàn tất quy trình tuyển dụng và thiết lập hồ sơ nhân viên chính thức.',
    candidateVisibleMessage: 'Chúc mừng bạn đã chính thức trở thành nhân viên! Hồ sơ đã được chuyển sang mục Nhân viên.',
  });
  await application.save();

  // Create authoritative Employment record
  const offer = application.offer || {};
  const employment = await Employment.create({
    employerUserId,
    employeeUserId: application.studentId,
    sourceApplicationId: application._id,
    jobId: job._id,
    workplace: offer.workplace || job.storeName || 'Cửa hàng',
    positionTitle: offer.position || application.selectedPosition || job.title || 'Nhân viên bán ca',
    status: 'active',
    startDate: offer.proposedStartDate || new Date(),
    wageRate: offer.wage || job.salaryAmount || 25000,
    wageUnit: offer.wageUnit || job.salaryUnit || 'hour',
    contractType: 'part_time',
    createdBy: employerUserId,
    activatedBy: employerUserId,
    history: [{
      status: 'active',
      changedAt: new Date(),
      note: 'Tuyển dụng thành công từ đề nghị nhận việc.',
    }],
  });

  // Notify student & employer
  try {
    await Notification.create({
      userId: application.studentId,
      title: 'Chào mừng bạn đã trở thành nhân viên chính thức! 🎊',
      message: `Bạn đã chính thức gia nhập ${employment.workplace} ở vị trí "${employment.positionTitle}". Bạn có thể xem lịch ca và chấm công tại mục Ca làm việc.`,
      type: 'employment',
      link: '/student/shifts',
    });

    if (employerUserId) {
      await Notification.create({
        userId: employerUserId,
        title: 'Tuyển dụng nhân viên mới thành công! 👤',
        message: `Ứng viên ${application.studentName} đã trở thành nhân viên chính thức. Hãy vào mục Nhân viên hoặc Xếp ca để xếp lịch làm.`,
        type: 'employment',
        link: '/employer/employees',
      });
    }
  } catch (notifErr) {
    console.warn('Failed to send hiring notifications:', notifErr.message);
  }

  return { application, employment };
}
