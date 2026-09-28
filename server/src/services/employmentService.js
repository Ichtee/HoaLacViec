import mongoose from 'mongoose';
import { Employment } from '../models/Employment.js';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';

export async function assertEmploymentEmployerAccess(employment, actorUserId) {
  const profile = await EmployerProfile.findOne({ userId: actorUserId });
  const allowed = [actorUserId.toString()];
  if (profile) allowed.push(profile._id.toString());

  if (allowed.includes(employment.employerUserId.toString())) return true;

  const err = new Error('Bạn không có quyền quản lý nhân viên này.');
  err.code = 'FORBIDDEN';
  err.status = 403;
  throw err;
}

/**
 * Get employments for employer or employee
 */
export async function getEmployments({ employerUserId, employeeUserId, status, search }) {
  const filter = {};
  if (employerUserId) filter.employerUserId = employerUserId;
  if (employeeUserId) filter.employeeUserId = employeeUserId;
  if (status) filter.status = status;

  let query = Employment.find(filter)
    .populate('employeeUserId', 'name phone email avatar studentProfile')
    .populate('jobId', 'title storeName address')
    .sort({ createdAt: -1 });

  const list = await query.lean();

  const formatted = list.map(emp => {
    const user = emp.employeeUserId || {};
    const job = emp.jobId || {};
    return {
      ...emp,
      id: emp._id,
      studentName: user.name || 'Nhân viên',
      studentPhone: user.phone || '',
      studentEmail: user.email || '',
      avatar: user.avatar || '',
      jobTitle: job.title || emp.positionTitle,
      storeName: job.storeName || emp.workplace,
    };
  });

  if (search) {
    const q = search.trim().toLowerCase();
    return formatted.filter(e => {
      const name = (e.studentName || '').toLowerCase();
      const phone = (e.studentPhone || '').toLowerCase();
      const pos = (e.positionTitle || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || pos.includes(q);
    });
  }

  return formatted;
}

/**
 * Terminate employment (soft transition)
 */
export async function terminateEmployment(employmentId, actorUserId, { reasonCode, note, futureShiftAction = 'cancel' } = {}) {
  const employment = await Employment.findById(employmentId);
  if (!employment) {
    const err = new Error('Không tìm thấy thông tin nhân viên.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  await assertEmploymentEmployerAccess(employment, actorUserId);

  if (employment.status === 'terminated') {
    const err = new Error('Nhân viên này đã kết thúc làm việc từ trước.');
    err.code = 'ALREADY_TERMINATED';
    err.status = 409;
    throw err;
  }

  const oldStatus = employment.status;
  employment.status = 'terminated';
  employment.endDate = new Date();
  employment.terminationReasonCode = reasonCode || 'other';
  employment.terminationNote = note || '';
  employment.terminatedBy = actorUserId;

  employment.history.push({
    status: 'terminated',
    changedAt: new Date(),
    changedBy: actorUserId,
    note: note || `Kết thúc làm việc (Lý do: ${reasonCode || 'Khác'})`,
  });

  await employment.save();

  // Handle future shifts (scheduled / published / draft)
  let cancelledShiftsCount = 0;
  if (futureShiftAction === 'cancel') {
    const now = new Date();
    const futureShifts = await Shift.find({
      studentUserId: employment.employeeUserId,
      employerUserId: employment.employerUserId,
      startAt: { $gte: now },
      status: { $in: ['draft', 'published', 'acknowledged', 'scheduled'] },
    });

    for (const shift of futureShifts) {
      shift.status = 'cancelled';
      shift.cancelReason = `Nhân viên đã kết thúc làm việc: ${note || 'Nghỉ việc'}`;
      shift.history.push({
        status: 'cancelled',
        changedAt: new Date(),
        changedBy: actorUserId,
        note: `Tự động hủy ca do nhân viên nghỉ việc: ${note || ''}`,
      });
      await shift.save();
      cancelledShiftsCount++;
    }
  }

  // Notify student
  try {
    await Notification.create({
      userId: employment.employeeUserId,
      title: 'Thông báo kết thúc hợp tác làm việc',
      message: `Quán ${employment.workplace} đã cập nhật trạng thái kết thúc hợp tác đối với bạn. Lý do: ${note || 'Hoàn tất hợp đồng'}.`,
      type: 'employment',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student of termination:', notifErr.message);
  }

  return { employment, cancelledShiftsCount };
}

/**
 * Update employment details (wage, position, status)
 */
export async function updateEmployment(employmentId, actorUserId, updates = {}) {
  const employment = await Employment.findById(employmentId);
  if (!employment) {
    const err = new Error('Không tìm thấy thông tin nhân viên.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  await assertEmploymentEmployerAccess(employment, actorUserId);

  if (updates.positionTitle) employment.positionTitle = updates.positionTitle;
  if (updates.wageRate !== undefined) employment.wageRate = Number(updates.wageRate);
  if (updates.wageUnit) employment.wageUnit = updates.wageUnit;
  if (updates.status && ['active', 'suspended', 'onboarding'].includes(updates.status)) {
    if (employment.status !== updates.status) {
      employment.status = updates.status;
      employment.history.push({
        status: updates.status,
        changedAt: new Date(),
        changedBy: actorUserId,
        note: updates.note || `Cập nhật trạng thái thành ${updates.status}`,
      });
    }
  }

  await employment.save();
  return employment;
}
