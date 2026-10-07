import { Shift } from '../../models/Shift.js';
import { Notification } from '../../models/Notification.js';
import { ATTENDANCE_STATUSES, PAYROLL_STATUSES, assertCanTransition } from '../../domain/shiftLifecycle.js';
import { assertIsEmployerOwnerOrAdmin } from './guards.js';

/**
 * Student or Employer flags shift for dispute
 */
export async function disputeShift(shiftId, actor, { disputeReason }) {
  if (!disputeReason || !String(disputeReason).trim()) {
    const err = new Error('Vui lòng cung cấp lý do đối soát/khiếu nại ca.');
    err.status = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const actorIdStr = String(actor._id || actor.id);
  const isAssigned = actorIdStr === String(shift.studentUserId?._id || shift.studentUserId || shift.studentId);
  const isOwner = actorIdStr === String(shift.employerUserId?._id || shift.employerUserId || shift.employerId);

  if (!isAssigned && !isOwner && actor.role !== 'admin') {
    const err = new Error('Bạn không có quyền khiếu nại ca làm việc này.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Không thể khiếu nại ca làm việc đã thanh toán lương.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }

  assertCanTransition('attendance', shift.attendanceStatus, ATTENDANCE_STATUSES.DISPUTED);

  shift.attendanceStatus = ATTENDANCE_STATUSES.DISPUTED;
  shift.disputeReason = disputeReason.trim();
  shift.history.push({
    status: 'disputed',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.DISPUTED,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Yêu cầu đối soát: ${disputeReason.trim()}`,
  });

  await shift.save();

  // Notify opposite party
  const targetUserId = isAssigned ? shift.employerUserId : shift.studentUserId;
  if (targetUserId) {
    try {
      await Notification.create({
        userId: targetUserId,
        title: 'Yêu cầu đối soát ca làm việc ⚠️',
        message: `${actor.name || 'Người dùng'} vừa gửi yêu cầu đối soát ca ngày ${shift.date}. Lý do: ${disputeReason.trim()}`,
        type: 'shift',
        link: isAssigned ? '/employer/shifts' : '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify dispute:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Resolve dispute
 */
export async function resolveDispute(shiftId, actor, { resolution, adjustedMinutes, note = '' }) {
  if (!['accepted', 'rejected'].includes(resolution)) {
    const err = new Error('Phương án giải quyết đối soát không hợp lệ (accepted hoặc rejected).');
    err.status = 400;
    err.code = 'INVALID_RESOLUTION';
    throw err;
  }

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.attendanceStatus !== ATTENDANCE_STATUSES.DISPUTED) {
    const err = new Error('Ca làm việc này hiện không ở trạng thái đối soát.');
    err.status = 400;
    err.code = 'NOT_DISPUTED';
    throw err;
  }

  if (resolution === 'accepted' && Number(adjustedMinutes) > 0) {
    const mins = Number(adjustedMinutes);
    const hours = Math.round((mins / 60) * 100) / 100;
    const rate = shift.wageRate || 25000;
    shift.workedMinutes = mins;
    shift.hours = hours;
    shift.totalPay = Math.round(hours * rate);
  }

  shift.attendanceStatus = ATTENDANCE_STATUSES.APPROVED;
  shift.disputeResolution = {
    resolvedAt: new Date(),
    resolvedBy: actor._id,
    resolution,
    note: note || '',
    adjustedMinutes: Number(adjustedMinutes) || shift.workedMinutes,
  };

  shift.history.push({
    status: 'approved',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.APPROVED,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Giải quyết đối soát: ${resolution === 'accepted' ? 'Chấp nhận điều chỉnh' : 'Giữ nguyên'}. Ghi chú: ${note || 'Không có'}`,
  });

  await shift.save();

  // Notify student
  if (shift.studentUserId) {
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Đối soát ca làm việc đã được xử lý 📋',
        message: `Quản lý đã xử lý yêu cầu đối soát ca ngày ${shift.date}: ${resolution === 'accepted' ? 'Đã chấp nhận điều chỉnh' : 'Giữ nguyên'}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student of dispute resolution:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}
