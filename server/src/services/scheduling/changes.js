import { Shift, parseVietnamDateTime } from '../../models/Shift.js';
import { Notification } from '../../models/Notification.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
  assertCanTransition,
} from '../../domain/shiftLifecycle.js';
import { assertIsEmployerOwnerOrAdmin } from './guards.js';
import { validateShiftEligibilityAndConflict } from './eligibility.js';

/**
 * Reschedule shift
 */
export async function rescheduleShift(shiftId, scheduleData, actor) {
  const { date, startTime, endTime, wageRate, reason } = scheduleData;

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  // Terminal checks
  if (shift.scheduleStatus === SCHEDULE_STATUSES.CANCELLED) {
    const err = new Error('Không thể điều chỉnh ca làm việc đã bị hủy.');
    err.status = 400;
    err.code = 'SHIFT_CANCELLED';
    throw err;
  }
  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Không thể điều chỉnh ca làm việc đã được thanh toán lương.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }
  if (shift.attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) {
    const err = new Error('Không thể dời lịch ca làm việc đang diễn ra.');
    err.status = 400;
    err.code = 'ATTENDANCE_IN_PROGRESS';
    throw err;
  }

  // Published shifts require reason
  if (shift.scheduleStatus === SCHEDULE_STATUSES.PUBLISHED && (!reason || !String(reason).trim())) {
    const err = new Error('Vui lòng cung cấp lý do điều chỉnh lịch ca đã công bố.');
    err.status = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  const newDate = date || shift.date;
  const newStartTime = startTime || shift.startTime;
  const newEndTime = endTime || shift.endTime;
  const isOvernight = newEndTime <= newStartTime;
  const newStartAt = parseVietnamDateTime(newDate, newStartTime, false);
  const newEndAt = parseVietnamDateTime(newDate, newEndTime, isOvernight);

  // Re-check conflict
  if (shift.studentUserId) {
    await validateShiftEligibilityAndConflict({
      studentUserId: shift.studentUserId,
      employerUserId: shift.employerUserId,
      startAt: newStartAt,
      endAt: newEndAt,
      excludeShiftId: shift._id,
    });
  }

  const diffHours = (newEndAt.getTime() - newStartAt.getTime()) / (1000 * 60 * 60);
  const newHours = Math.round(diffHours * 100) / 100;
  const newRate = Number(wageRate) || shift.wageRate || 25000;

  shift.date = newDate;
  shift.startTime = newStartTime;
  shift.endTime = newEndTime;
  shift.startAt = newStartAt;
  shift.endAt = newEndAt;
  shift.hours = newHours;
  shift.wageRate = newRate;
  shift.wageSnapshot = {
    hourlyRate: newRate,
    estimatedHours: newHours,
    estimatedPay: newHours * newRate,
  };

  // If published, increment revision and require re-acknowledgement
  if (shift.scheduleStatus === SCHEDULE_STATUSES.PUBLISHED) {
    shift.scheduleRevision = (shift.scheduleRevision || 1) + 1;
    shift.assignmentStatus = ASSIGNMENT_STATUSES.ASSIGNED; // Reset to assigned
    shift.acknowledgedRevision = 0;
  }

  shift.history.push({
    status: shift.status,
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Điều chỉnh lịch (Bản sửa đổi #${shift.scheduleRevision}): ${newDate} ${newStartTime}-${newEndTime}. Lý do: ${reason || 'Quản lý điều chỉnh'}`,
  });

  await shift.save();

  // Notify student
  if (shift.scheduleStatus === SCHEDULE_STATUSES.PUBLISHED && shift.studentUserId) {
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Ca làm việc đã được điều chỉnh ⚠️',
        message: `Quản lý đã dời lịch ca làm sang ngày ${newDate} (${newStartTime}-${newEndTime}). Lý do: ${reason}. Vui lòng xác nhận lại.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student of reschedule:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Cancel shift
 */
export async function cancelShift(shiftId, actor, reason = '') {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);
  assertCanTransition('schedule', shift.scheduleStatus, SCHEDULE_STATUSES.CANCELLED);

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Không thể hủy ca làm việc đã thanh toán lương.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }
  if (shift.attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) {
    const err = new Error('Không thể hủy ca làm việc đang diễn ra.');
    err.status = 400;
    err.code = 'ATTENDANCE_IN_PROGRESS';
    throw err;
  }

  shift.scheduleStatus = SCHEDULE_STATUSES.CANCELLED;
  shift.cancelReason = reason || 'Quản lý hủy ca làm';
  shift.history.push({
    status: SCHEDULE_STATUSES.CANCELLED,
    scheduleStatus: SCHEDULE_STATUSES.CANCELLED,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Hủy ca làm việc. Lý do: ${reason || 'Không nêu'}`,
  });

  await shift.save();

  // Notify student
  if (shift.studentUserId) {
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Ca làm việc đã bị hủy ❌',
        message: `Ca làm ngày ${shift.date} (${shift.startTime}-${shift.endTime}) tại ${shift.storeName} đã bị hủy. Lý do: ${reason || 'Kế hoạch thay đổi'}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}
