import { Shift } from '../../models/Shift.js';
import { Notification } from '../../models/Notification.js';
import { ATTENDANCE_STATUSES, PAYROLL_STATUSES, assertCanTransition } from '../../domain/shiftLifecycle.js';
import { assertIsEmployerOwnerOrAdmin } from './guards.js';

/**
 * Mark shift payroll ready
 */
export async function markPayrollReady(shiftId, actor) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);

  if (shift.attendanceStatus !== ATTENDANCE_STATUSES.APPROVED) {
    const err = new Error('Chỉ có thể chuẩn bị trả lương cho ca làm việc đã được duyệt công.');
    err.status = 400;
    err.code = 'ATTENDANCE_NOT_APPROVED';
    throw err;
  }

  assertCanTransition('payroll', shift.payrollStatus, PAYROLL_STATUSES.READY);

  shift.payrollStatus = PAYROLL_STATUSES.READY;
  shift.history.push({
    status: 'payroll_ready',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: PAYROLL_STATUSES.READY,
    changedAt: new Date(),
    changedBy: actor._id,
    note: 'Chuyển sang trạng thái sẵn sàng chi trả lương',
  });

  await shift.save();
  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Mark shift paid
 */
export async function markPaid(shiftId, actor, { paymentReference = '', note = '' } = {}) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertIsEmployerOwnerOrAdmin(shift, actor);
  assertCanTransition('payroll', shift.payrollStatus, PAYROLL_STATUSES.PAID);

  shift.payrollStatus = PAYROLL_STATUSES.PAID;
  shift.history.push({
    status: 'paid',
    scheduleStatus: shift.scheduleStatus,
    attendanceStatus: shift.attendanceStatus,
    payrollStatus: PAYROLL_STATUSES.PAID,
    changedAt: new Date(),
    changedBy: actor._id,
    note: `Thanh toán hoàn tất. Mã GD: ${paymentReference || 'Tiền mặt'}. Ghi chú: ${note || 'Không có'}`,
  });

  await shift.save();

  // Notify student
  if (shift.studentUserId) {
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Đã nhận thanh toán tiền ca làm 💵',
        message: `Quản lý đã thanh toán tiền lương cho ca ngày ${shift.date} (${(shift.totalPay || 0).toLocaleString('vi-VN')}đ).`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student of payment:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}
