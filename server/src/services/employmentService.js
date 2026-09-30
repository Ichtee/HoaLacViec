import mongoose from 'mongoose';
import { Employment } from '../models/Employment.js';
import { Shift } from '../models/Shift.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { SCHEDULE_STATUSES, ATTENDANCE_STATUSES, PAYROLL_STATUSES } from '../domain/shiftLifecycle.js';
import { normalizeTransactionError } from '../utils/transactionError.js';

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
  if (!['cancel', 'keep'].includes(futureShiftAction)) {
    const err = new Error('Cách xử lý ca tương lai không hợp lệ.');
    err.status = 400;
    err.code = 'INVALID_SHIFT_ACTION';
    throw err;
  }
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

  let cancelledShiftsCount = 0;
  let terminatedEmployment;
  try {
    await mongoose.connection.transaction(async (session) => {
      let cancelledInAttempt = 0;
      const current = await Employment.findById(employmentId).session(session);
      if (!current || current.status === 'terminated') {
        const err = new Error('Nhân viên này đã kết thúc làm việc từ trước.');
        err.code = 'ALREADY_TERMINATED';
        err.status = 409;
        throw err;
      }
      const now = new Date();
      if (futureShiftAction === 'cancel') {
        const futureShifts = await Shift.find({
          employerUserId: current.employerUserId,
          $or: [
            { employmentId: current._id },
            { employmentId: null, studentUserId: current.employeeUserId },
          ],
          startAt: { $gte: now },
          scheduleStatus: { $in: [SCHEDULE_STATUSES.DRAFT, SCHEDULE_STATUSES.PUBLISHED] },
          attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
          payrollStatus: PAYROLL_STATUSES.NOT_READY,
        }).session(session);
        for (const shift of futureShifts) {
          shift.scheduleStatus = SCHEDULE_STATUSES.CANCELLED;
          shift.cancelReason = `Nhân viên đã kết thúc làm việc: ${note || 'Nghỉ việc'}`;
          shift.history.push({
            status: SCHEDULE_STATUSES.CANCELLED,
            scheduleStatus: SCHEDULE_STATUSES.CANCELLED,
            changedAt: now,
            changedBy: actorUserId,
            note: `Tự động hủy ca do nhân viên nghỉ việc: ${note || ''}`,
          });
          await shift.save({ session });
          cancelledInAttempt++;
        }
      }
      current.status = 'terminated';
      current.endDate = now;
      current.terminationReasonCode = reasonCode || 'other';
      current.terminationNote = note || '';
      current.terminatedBy = actorUserId;
      current.history.push({
        status: 'terminated', changedAt: now, changedBy: actorUserId,
        note: note || `Kết thúc làm việc (Lý do: ${reasonCode || 'Khác'})`,
      });
      await current.save({ session });
      cancelledShiftsCount = cancelledInAttempt;
      terminatedEmployment = current;
    });
  } catch (error) {
    throw normalizeTransactionError(error);
  }

  // Notify student
  try {
    await Notification.create({
      userId: terminatedEmployment.employeeUserId,
      title: 'Thông báo kết thúc hợp tác làm việc',
      message: `Quán ${terminatedEmployment.workplace} đã cập nhật trạng thái kết thúc hợp tác đối với bạn. Lý do: ${note || 'Hoàn tất hợp đồng'}.`,
      type: 'employment',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student of termination:', notifErr.message);
  }

  return { employment: terminatedEmployment, cancelledShiftsCount };
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

  if (employment.status === 'terminated') {
    const err = new Error('Quan hệ làm việc đã kết thúc. Hãy tạo quan hệ mới nếu tuyển dụng lại.');
    err.code = 'EMPLOYMENT_TERMINATED';
    err.status = 409;
    throw err;
  }

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
