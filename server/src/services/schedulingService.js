import mongoose from 'mongoose';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { TimeOffRequest } from '../models/TimeOffRequest.js';
import { Notification } from '../models/Notification.js';
import { EmployerProfile } from '../models/EmployerProfile.js';

/**
 * Validate employment eligibility and check for schedule conflicts
 */
export async function validateShiftEligibilityAndConflict({
  studentUserId,
  employerUserId,
  startAt,
  endAt,
  excludeShiftId = null,
}) {
  if (!startAt || !endAt || startAt >= endAt) {
    const err = new Error('Thời gian ca làm việc không hợp lệ (Giờ bắt đầu phải trước giờ kết thúc).');
    err.code = 'INVALID_TIME_RANGE';
    err.status = 400;
    throw err;
  }

  // 1. Verify Active Employment
  const employment = await Employment.findOne({
    employeeUserId: studentUserId,
    employerUserId: employerUserId,
    status: { $in: ['active', 'onboarding'] },
  });

  if (!employment) {
    const err = new Error('Sinh viên không có quan hệ nhân viên đang hoạt động (active employment) tại cơ sở này.');
    err.code = 'EMPLOYMENT_INACTIVE';
    err.status = 400;
    throw err;
  }

  // 2. Check for TimeOffRequest conflict
  const approvedTimeOff = await TimeOffRequest.findOne({
    employeeUserId: studentUserId,
    status: 'approved',
    startDate: { $lte: endAt },
    endDate: { $gte: startAt },
  });

  if (approvedTimeOff) {
    const err = new Error('Sinh viên đã được duyệt nghỉ phép trong khoảng thời gian này.');
    err.code = 'TIME_OFF_CONFLICT';
    err.status = 409;
    throw err;
  }

  // 3. Strict Shift Overlap Conflict Check:
  // An overlap exists if: (existing.startAt < new.endAt) AND (existing.endAt > new.startAt)
  // Non-overlapping abutments (e.g. 08:00-12:00 and 12:00-16:00) are allowed because 12:00 > 12:00 is false.
  const conflictFilter = {
    studentUserId: studentUserId,
    status: { $nin: ['cancelled'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };

  if (excludeShiftId) {
    conflictFilter._id = { $ne: excludeShiftId };
  }

  const conflictingShift = await Shift.findOne(conflictFilter).lean();

  if (conflictingShift) {
    const conflictDate = conflictingShift.date || '';
    const conflictStart = conflictingShift.startTime || '';
    const conflictEnd = conflictingShift.endTime || '';
    const conflictRole = conflictingShift.role || 'Ca làm';

    const err = new Error(
      `Xung đột lịch làm việc! Sinh viên đã có ca "${conflictRole}" vào ngày ${conflictDate} (${conflictStart} - ${conflictEnd}). Không thể xếp 2 ca trùng giờ.`
    );
    err.code = 'SHIFT_CONFLICT';
    err.status = 409;
    err.conflictingShift = conflictingShift;
    throw err;
  }

  return { employment };
}

/**
 * Create a shift (draft or published)
 */
export async function createShift(data, actorUserId) {
  const {
    studentUserId,
    jobId,
    date,
    startTime,
    endTime,
    role,
    wageRate,
    isDraft = false,
    storeName,
  } = data;

  const isOvernight = endTime <= startTime;
  const startAt = parseVietnamDateTime(date, startTime, false);
  const endAt = parseVietnamDateTime(date, endTime, isOvernight);

  // Validate eligibility and overlap conflict
  const { employment } = await validateShiftEligibilityAndConflict({
    studentUserId,
    employerUserId: actorUserId,
    startAt,
    endAt,
  });

  // Calculate planned hours
  let hours = 4;
  try {
    const diffMs = endAt.getTime() - startAt.getTime();
    hours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
  } catch {
    // fallback
  }

  const effectiveRate = Number(wageRate) || employment.wageRate || 25000;
  const initialStatus = isDraft ? 'draft' : 'published';

  const student = await User.findById(studentUserId);

  const newShift = await Shift.create({
    jobId: jobId || employment.jobId,
    employmentId: employment._id,
    storeName: storeName || employment.workplace || 'Cửa hàng',
    employerUserId: actorUserId,
    employerId: actorUserId,
    studentUserId: student._id,
    studentId: student._id,
    studentName: student.name,
    role: role || employment.positionTitle || 'Nhân viên bán ca',
    date,
    startTime,
    endTime,
    startAt,
    endAt,
    hours,
    wageRate: effectiveRate,
    totalPay: Math.round(hours * effectiveRate),
    status: initialStatus,
    publishedAt: isDraft ? null : new Date(),
    history: [{
      status: initialStatus,
      changedAt: new Date(),
      changedBy: actorUserId,
      note: isDraft ? 'Tạo ca làm ở trạng thái nháp.' : 'Phân ca làm và công bố lịch trực tiếp cho sinh viên.',
    }],
  });

  // If published immediately, notify student
  if (!isDraft) {
    try {
      await Notification.create({
        userId: student._id,
        title: 'Bạn có ca làm việc mới! 📅',
        message: `Bạn được xếp ca "${newShift.role}" ngày ${date} (${startTime} - ${endTime}) tại ${newShift.storeName}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to send shift notification:', notifErr.message);
    }
  }

  return newShift;
}

/**
 * Publish draft shifts
 */
export async function publishShifts({ shiftIds, employerUserId }) {
  if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
    return { publishedCount: 0 };
  }

  const shiftsToPublish = await Shift.find({
    _id: { $in: shiftIds },
    employerUserId: employerUserId,
    status: 'draft',
  });

  let publishedCount = 0;
  for (const shift of shiftsToPublish) {
    shift.status = 'published';
    shift.publishedAt = new Date();
    shift.history.push({
      status: 'published',
      changedAt: new Date(),
      changedBy: employerUserId,
      note: 'Công bố lịch ca làm việc.',
    });
    await shift.save();
    publishedCount++;

    // Notify student
    try {
      await Notification.create({
        userId: shift.studentUserId,
        title: 'Lịch làm việc đã được công bố! 📅',
        message: `Ca ngày ${shift.date} (${shift.startTime} - ${shift.endTime}) tại ${shift.storeName} đã được công bố. Vui lòng xác nhận lịch.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student:', notifErr.message);
    }
  }

  return { publishedCount };
}

/**
 * Student acknowledges shift schedule
 */
export async function acknowledgeShift(shiftId, studentUserId) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (shift.studentUserId.toString() !== studentUserId.toString()) {
    const err = new Error('Bạn không có quyền xác nhận ca làm của người khác.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  if (shift.status !== 'published') {
    const err = new Error('Chỉ có thể xác nhận ca làm khi ca đã được công bố (published).');
    err.code = 'INVALID_STATUS';
    err.status = 400;
    throw err;
  }

  shift.status = 'acknowledged';
  shift.acknowledgedAt = new Date();
  shift.history.push({
    status: 'acknowledged',
    changedAt: new Date(),
    changedBy: studentUserId,
    note: 'Sinh viên đã xác nhận lịch làm việc.',
  });

  await shift.save();
  return shift;
}

/**
 * Reschedule shift with conflict validation
 */
export async function rescheduleShift(shiftId, scheduleData, actorUserId) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (shift.employerUserId.toString() !== actorUserId.toString()) {
    const err = new Error('Bạn không có quyền đổi lịch ca làm này.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  if (['checked_in', 'checked_out', 'approved', 'paid'].includes(shift.status)) {
    const err = new Error('Không thể đổi lịch ca làm đã check-in hoặc đã duyệt công.');
    err.code = 'CANNOT_RESCHEDULE';
    err.status = 400;
    throw err;
  }

  const { date, startTime, endTime } = scheduleData;
  const isOvernight = endTime <= startTime;
  const startAt = parseVietnamDateTime(date, startTime, false);
  const endAt = parseVietnamDateTime(date, endTime, isOvernight);

  // Validate conflict excluding current shift
  await validateShiftEligibilityAndConflict({
    studentUserId: shift.studentUserId,
    employerUserId: actorUserId,
    startAt,
    endAt,
    excludeShiftId: shift._id,
  });

  const oldDate = shift.date;
  const oldStart = shift.startTime;
  const oldEnd = shift.endTime;

  shift.date = date;
  shift.startTime = startTime;
  shift.endTime = endTime;
  shift.startAt = startAt;
  shift.endAt = endAt;

  shift.history.push({
    status: shift.status,
    changedAt: new Date(),
    changedBy: actorUserId,
    note: `Đổi lịch ca làm: từ [${oldDate} ${oldStart}-${oldEnd}] sang [${date} ${startTime}-${endTime}].`,
  });

  await shift.save();

  // Notify student
  try {
    await Notification.create({
      userId: shift.studentUserId,
      title: 'Lịch ca làm việc đã thay đổi! ⚠️',
      message: `Ca làm tại ${shift.storeName} đã đổi sang ngày ${date} (${startTime} - ${endTime}).`,
      type: 'shift',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student:', notifErr.message);
  }

  return shift;
}

/**
 * Cancel shift (Soft cancellation)
 */
export async function cancelShift(shiftId, actorUserId, reason = '') {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (['approved', 'paid'].includes(shift.status)) {
    const err = new Error('Không thể hủy ca làm đã được duyệt công hoặc đã chi trả.');
    err.code = 'CANNOT_CANCEL_APPROVED';
    err.status = 400;
    throw err;
  }

  shift.status = 'cancelled';
  shift.cancelReason = reason || 'Nhà tuyển dụng hủy ca làm';
  shift.history.push({
    status: 'cancelled',
    changedAt: new Date(),
    changedBy: actorUserId,
    note: `Hủy ca làm: ${reason || 'Không có lý do'}`,
  });

  await shift.save();

  // Notify student
  try {
    await Notification.create({
      userId: shift.studentUserId,
      title: 'Ca làm việc đã bị hủy',
      message: `Ca ngày ${shift.date} (${shift.startTime} - ${shift.endTime}) tại ${shift.storeName} đã bị hủy. Lý do: ${reason || 'Kế hoạch quán thay đổi'}.`,
      type: 'shift',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student:', notifErr.message);
  }

  return shift;
}

/**
 * Approve timesheet (duyệt công - independent from payroll)
 */
export async function approveAttendance(shiftId, actorUserId) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!['completed_pending_review', 'pending_approval', 'checked_out'].includes(shift.status)) {
    const err = new Error('Chỉ có thể duyệt công sau khi sinh viên đã check-out ra ca.');
    err.code = 'CANNOT_APPROVE_UNFINISHED';
    err.status = 400;
    throw err;
  }

  shift.status = 'approved';
  shift.history.push({
    status: 'approved',
    changedAt: new Date(),
    changedBy: actorUserId,
    note: 'Quản lý đã duyệt bảng công làm việc hợp lệ.',
  });

  await shift.save();

  // Notify student
  try {
    await Notification.create({
      userId: shift.studentUserId,
      title: 'Bảng công đã được duyệt! ✅',
      message: `Ca làm ngày ${shift.date} đã được duyệt công (${shift.workedMinutes} phút, thu nhập: ${(shift.totalPay || 0).toLocaleString('vi-VN')} VNĐ).`,
      type: 'shift',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student:', notifErr.message);
  }

  return shift;
}

/**
 * Mark payroll ready
 */
export async function markPayrollReady(shiftId, actorUserId) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (shift.status !== 'approved') {
    const err = new Error('Ca làm phải được duyệt công (approved) trước khi sẵn sàng tính lương.');
    err.code = 'INVALID_STATUS';
    err.status = 400;
    throw err;
  }

  shift.status = 'payroll_ready';
  shift.history.push({
    status: 'payroll_ready',
    changedAt: new Date(),
    changedBy: actorUserId,
    note: 'Chuyển sang trạng thái sẵn sàng chi trả lương.',
  });

  await shift.save();
  return shift;
}

/**
 * Mark shift paid
 */
export async function markPaid(shiftId, actorUserId) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!['approved', 'payroll_ready'].includes(shift.status)) {
    const err = new Error('Ca làm phải được duyệt công trước khi đánh dấu đã trả lương.');
    err.code = 'INVALID_STATUS';
    err.status = 400;
    throw err;
  }

  shift.status = 'paid';
  shift.history.push({
    status: 'paid',
    changedAt: new Date(),
    changedBy: actorUserId,
    note: 'Đã hoàn tất thanh toán tiền lương cho sinh viên.',
  });

  await shift.save();

  // Notify student
  try {
    await Notification.create({
      userId: shift.studentUserId,
      title: 'Đã nhận thanh toán lương ca làm! 💰',
      message: `Ca ngày ${shift.date} đã được quán thanh toán lương (${(shift.totalPay || 0).toLocaleString('vi-VN')} VNĐ).`,
      type: 'shift',
      link: '/student/shifts',
    });
  } catch (notifErr) {
    console.warn('Failed to notify student:', notifErr.message);
  }

  return shift;
}

/**
 * Adjust worked minutes with audit trail
 */
export async function adjustWorkedTime(shiftId, actorUserId, { workedMinutes, reason }) {
  const shift = await Shift.findById(shiftId);
  if (!shift) {
    const err = new Error('Không tìm thấy ca làm việc.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!reason || !reason.trim()) {
    const err = new Error('Vui lòng cung cấp lý do điều chỉnh thời gian làm việc.');
    err.code = 'MISSING_REASON';
    err.status = 400;
    throw err;
  }

  const beforeMinutes = shift.workedMinutes || 0;
  const afterMinutes = Math.max(0, Number(workedMinutes));
  const newPay = Math.round((afterMinutes / 60) * (shift.wageRate || 25000));

  shift.workedMinutes = afterMinutes;
  shift.totalPay = newPay;
  shift.history.push({
    status: shift.status,
    changedAt: new Date(),
    changedBy: actorUserId,
    note: `Điều chỉnh công: từ ${beforeMinutes} phút thành ${afterMinutes} phút. Lý do: ${reason}`,
  });

  await shift.save();
  return shift;
}
