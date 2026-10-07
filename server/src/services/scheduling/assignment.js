import { Shift } from '../../models/Shift.js';
import { Notification } from '../../models/Notification.js';
import { ASSIGNMENT_STATUSES, assertCanTransition } from '../../domain/shiftLifecycle.js';
import { assertIsAssignedStudent } from './guards.js';

/**
 * Acknowledge shift (Student marked seen)
 */
export async function acknowledgeShift(shiftId, actor) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsAssignedStudent(shift, actor);
  assertCanTransition('assignment', shift.assignmentStatus, ASSIGNMENT_STATUSES.ACKNOWLEDGED);

  shift.assignmentStatus = ASSIGNMENT_STATUSES.ACKNOWLEDGED;
  shift.acknowledgedAt = new Date();
  shift.acknowledgedRevision = shift.scheduleRevision || 1;
  shift.history.push({
    status: 'acknowledged',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Sinh viên đã xác nhận xem thông tin lịch (Bản sửa đổi #${shift.scheduleRevision})`,
  });

  await shift.save();
  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Accept shift (Student accepts assignment)
 */
export async function acceptShift(shiftId, actor) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsAssignedStudent(shift, actor);
  assertCanTransition('assignment', shift.assignmentStatus, ASSIGNMENT_STATUSES.ACCEPTED);

  shift.assignmentStatus = ASSIGNMENT_STATUSES.ACCEPTED;
  shift.acknowledgedAt = new Date();
  shift.acknowledgedRevision = shift.scheduleRevision || 1;
  shift.history.push({
    status: 'accepted',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Sinh viên đồng ý nhận ca làm (Bản sửa đổi #${shift.scheduleRevision})`,
  });

  await shift.save();

  // Notify employer
  try {
    await Notification.create({
      userId: shift.employerUserId,
      title: 'Sinh viên đã nhận ca làm việc 🤝',
      message: `${actor.name || 'Nhân viên'} đã xác nhận nhận ca ngày ${shift.date} (${shift.startTime}-${shift.endTime}).`,
      type: 'shift',
      link: '/employer/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify employer:', notifErr.message);
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Decline shift (Student declines assignment with reason)
 */
export async function declineShift(shiftId, actor, reason) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('Vui lòng cung cấp lý do báo bận/từ chối ca.');
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

  assertIsAssignedStudent(shift, actor);
  assertCanTransition('assignment', shift.assignmentStatus, ASSIGNMENT_STATUSES.DECLINED);

  shift.assignmentStatus = ASSIGNMENT_STATUSES.DECLINED;
  shift.history.push({
    status: 'declined',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: shift.payrollStatus,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Sinh viên báo bận/từ chối ca: ${reason.trim()}`,
  });

  await shift.save();

  // Notify employer
  try {
    await Notification.create({
      userId: shift.employerUserId,
      title: 'Sinh viên báo bận ca làm việc ⚠️',
      message: `${actor.name || 'Nhân viên'} báo không thể làm ca ngày ${shift.date} (${shift.startTime}-${shift.endTime}). Lý do: ${reason.trim()}`,
      type: 'shift',
      link: '/employer/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify employer:', notifErr.message);
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}
