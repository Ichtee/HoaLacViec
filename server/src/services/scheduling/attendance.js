import { Shift } from '../../models/Shift.js';
import { Notification } from '../../models/Notification.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
  assertCanTransition,
} from '../../domain/shiftLifecycle.js';
import { assertIsEmployerOwnerOrAdmin } from './guards.js';

/**
 * Record Employee Attendance Start (Check-in / Có mặt) - Performed authoritatively by employer
 */
export async function recordAttendanceStart(shiftId, actor, { actualTime, note = '' } = {}) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.scheduleStatus !== SCHEDULE_STATUSES.PUBLISHED) {
    const err = new Error(`Chỉ có thể ghi nhận có mặt cho ca làm đã công bố (trạng thái hiện tại: ${shift.scheduleStatus}).`);
    err.status = 400;
    err.code = 'INVALID_STATUS';
    throw err;
  }

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Ca làm việc đã được chi trả lương, không thể thay đổi thông tin chấm công.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }

  // Idempotent: If already checked in, return current shift
  if (shift.attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) {
    return { shift: { ...shift.toObject(), id: shift._id }, alreadyCheckedIn: true };
  }

  assertCanTransition('attendance', shift.attendanceStatus, ATTENDANCE_STATUSES.CHECKED_IN);

  const checkInTime = actualTime ? new Date(actualTime) : new Date();

  shift.attendanceStatus = ATTENDANCE_STATUSES.CHECKED_IN;
  shift.assignmentStatus = ASSIGNMENT_STATUSES.ACCEPTED;
  shift.set('attendance.checkInAt', checkInTime);
  shift.set('attendance.checkInVerified', true);
  shift.set('attendance.checkInVerificationStatus', 'verified');
  shift.set('attendance.checkInManualReason', note || 'Nhà tuyển dụng xác nhận có mặt');

  shift.history.push({
    status: shift.status,
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.CHECKED_IN,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: note ? `Nhà tuyển dụng ghi nhận có mặt: ${note}` : 'Nhà tuyển dụng ghi nhận nhân viên có mặt vào ca',
  });

  await shift.save();

  // Notify employee
  const targetEmployeeId = shift.employeeUserId || shift.studentUserId;
  if (targetEmployeeId) {
    try {
      await Notification.create({
        userId: targetEmployeeId,
        title: 'Chấm công: Đã vào ca làm việc ⏱️',
        message: `Quản lý đã ghi nhận bạn vào ca ngày ${shift.date} (${shift.startTime}-${shift.endTime}).`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify employee of attendance start:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Record Employee Attendance End (Check-out / Hoàn thành ca) - Performed authoritatively by employer
 */
export async function recordAttendanceEnd(shiftId, actor, { actualTime, note = '' } = {}) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Ca làm việc đã được chi trả lương, không thể thay đổi thông tin chấm công.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }

  if (shift.attendanceStatus !== ATTENDANCE_STATUSES.CHECKED_IN) {
    const err = new Error('Chỉ có thể ghi nhận kết thúc ca cho nhân viên đang trong ca làm việc (đã ghi nhận vào ca).');
    err.status = 400;
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const checkOutTime = actualTime ? new Date(actualTime) : new Date();
  const checkInTime = shift.attendance?.checkInAt ? new Date(shift.attendance.checkInAt) : new Date(shift.startAt);

  if (checkOutTime.getTime() < checkInTime.getTime()) {
    const err = new Error('Thời điểm kết thúc ca không được trước thời điểm vào ca.');
    err.status = 400;
    err.code = 'INVALID_TIME_ORDER';
    throw err;
  }

  const diffMs = checkOutTime.getTime() - checkInTime.getTime();
  const workedMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
  const hours = Math.round((workedMinutes / 60) * 100) / 100;
  const rate = shift.wageRate || 25000;
  const totalPay = Math.round(hours * rate);

  shift.attendanceStatus = ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW;
  shift.workedMinutes = workedMinutes;
  shift.hours = hours;
  shift.totalPay = totalPay;
  shift.set('attendance.checkOutAt', checkOutTime);
  shift.set('attendance.checkOutVerified', true);
  shift.set('attendance.checkOutVerificationStatus', 'verified');
  shift.set('attendance.checkOutManualReason', note || 'Nhà tuyển dụng xác nhận tan ca');

  shift.history.push({
    status: shift.status,
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: note
      ? `Nhà tuyển dụng ghi nhận tan ca: ${note} (${workedMinutes} phút, ${totalPay.toLocaleString('vi-VN')}đ)`
      : `Nhà tuyển dụng ghi nhận kết thúc ca: ${workedMinutes} phút (${hours}h), tổng công: ${totalPay.toLocaleString('vi-VN')}đ`,
  });

  await shift.save();

  // Notify employee
  const targetEmployeeId = shift.employeeUserId || shift.studentUserId;
  if (targetEmployeeId) {
    try {
      await Notification.create({
        userId: targetEmployeeId,
        title: 'Chấm công: Đã kết thúc ca làm việc 🏁',
        message: `Quản lý đã ghi nhận bạn hoàn thành ca ngày ${shift.date}. Tổng thời gian: ${workedMinutes} phút (~${totalPay.toLocaleString('vi-VN')}đ).`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify employee of attendance end:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Record Employee No-Show (Vắng mặt) - Performed authoritatively by employer
 */
export async function recordAttendanceNoShow(shiftId, actor, { reason = '', note = '' } = {}) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.scheduleStatus === SCHEDULE_STATUSES.CANCELLED) {
    const err = new Error('Không thể đánh dấu vắng mặt cho ca làm đã bị hủy.');
    err.status = 400;
    err.code = 'ALREADY_CANCELLED';
    throw err;
  }

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Ca làm việc đã được chi trả lương, không thể thay đổi thành vắng mặt.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }

  if (['approved', 'completed_pending_review', 'checked_out'].includes(shift.attendanceStatus)) {
    const err = new Error('Không thể đánh dấu vắng mặt cho ca làm đã hoàn tất hoặc đã duyệt công.');
    err.status = 400;
    err.code = 'ALREADY_COMPLETED';
    throw err;
  }

  assertCanTransition('attendance', shift.attendanceStatus, ATTENDANCE_STATUSES.NO_SHOW);

  const absenceReason = reason || note || 'Vắng mặt không phép';

  shift.attendanceStatus = ATTENDANCE_STATUSES.NO_SHOW;
  shift.workedMinutes = 0;
  shift.totalPay = 0;
  shift.employerNotes = absenceReason;

  shift.history.push({
    status: shift.status,
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.NO_SHOW,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Nhà tuyển dụng đánh dấu nhân viên vắng mặt. Lý do: ${absenceReason}`,
  });

  await shift.save();

  // Notify employee
  const targetEmployeeId = shift.employeeUserId || shift.studentUserId;
  if (targetEmployeeId) {
    try {
      await Notification.create({
        userId: targetEmployeeId,
        title: 'Chấm công: Ghi nhận vắng mặt ⚠️',
        message: `Quản lý đã ghi nhận bạn vắng mặt trong ca ngày ${shift.date} (${shift.startTime}-${shift.endTime}). Lý do: ${absenceReason}`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify employee of no-show:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Approve attendance & lock timesheet
 */
export async function approveAttendance(shiftId, actor, { approvedMinutes, managerNote = '' } = {}) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);
  assertCanTransition('attendance', shift.attendanceStatus, ATTENDANCE_STATUSES.APPROVED);

  const minutes = Number(approvedMinutes) > 0 ? Number(approvedMinutes) : (shift.hours || 4) * 60;
  const hours = Math.round((minutes / 60) * 100) / 100;
  const rate = shift.wageRate || 25000;

  shift.attendanceStatus = ATTENDANCE_STATUSES.APPROVED;
  shift.workedMinutes = minutes;
  shift.hours = hours;
  shift.totalPay = Math.round(hours * rate);
  shift.employerNotes = managerNote || shift.employerNotes;

  shift.history.push({
    status: 'approved',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: ATTENDANCE_STATUSES.APPROVED,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Duyệt công: ${minutes} phút (${hours}h), tổng tiền: ${shift.totalPay.toLocaleString('vi-VN')}đ. Ghi chú: ${managerNote || 'Không có'}`,
  });

  await shift.save();

  // Notify student
  if (shift.studentUserId) {
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Ca làm đã được duyệt công 🎉',
        message: `Ca ngày ${shift.date} đã được duyệt ${hours} giờ công (${shift.totalPay.toLocaleString('vi-VN')}đ).`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Adjust worked time
 */
export async function adjustWorkedTime(shiftId, actor, { adjustedMinutes, reason }) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('Vui lòng cung cấp lý do điều chỉnh giờ công.');
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

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.payrollStatus === PAYROLL_STATUSES.PAID) {
    const err = new Error('Không thể điều chỉnh ca làm việc đã thanh toán lương.');
    err.status = 400;
    err.code = 'ALREADY_PAID';
    throw err;
  }

  const oldMins = shift.workedMinutes || (shift.hours || 4) * 60;
  const newMins = Number(adjustedMinutes);
  const newHours = Math.round((newMins / 60) * 100) / 100;
  const rate = shift.wageRate || 25000;

  shift.workedMinutes = newMins;
  shift.hours = newHours;
  shift.totalPay = Math.round(newHours * rate);

  shift.history.push({
    status: shift.status,
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Điều chỉnh thời gian làm việc từ ${oldMins}p thành ${newMins}p. Lý do: ${reason.trim()}`,
  });

  await shift.save();
  return { shift: { ...shift.toObject(), id: shift._id } };
}
