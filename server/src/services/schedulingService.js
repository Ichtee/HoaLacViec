import mongoose from 'mongoose';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { TimeOffRequest } from '../models/TimeOffRequest.js';
import { Notification } from '../models/Notification.js';
import { ShiftTemplate } from '../models/ShiftTemplate.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
  assertCanTransition,
  evaluateSchedulingPolicies,
} from '../domain/shiftLifecycle.js';

/**
 * Strict Authorization Assertion: Employer Owner or Admin
 */
export function assertIsEmployerOwnerOrAdmin(shift, actor) {
  if (!actor) {
    const err = new Error('Yêu cầu xác thực tài khoản.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (actor.role === 'admin') return true;

  const actorIdStr = String(actor._id || actor.id);
  const shiftEmployerUserIdStr = String(shift.employerUserId?._id || shift.employerUserId || '');
  const shiftEmployerIdStr = String(shift.employerId?._id || shift.employerId || '');

  if (actorIdStr !== shiftEmployerUserIdStr && actorIdStr !== shiftEmployerIdStr) {
    const err = new Error('Bạn không có quyền thao tác trên ca làm việc của cơ sở này.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return true;
}

/**
 * Strict Authorization Assertion: Assigned Student
 */
export function assertIsAssignedStudent(shift, actor) {
  if (!actor) {
    const err = new Error('Yêu cầu xác thực tài khoản.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const actorIdStr = String(actor._id || actor.id);
  const studentUserIdStr = String(shift.studentUserId?._id || shift.studentUserId || shift.studentId || '');

  if (actorIdStr !== studentUserIdStr) {
    const err = new Error('Bạn không có quyền thao tác trên ca làm của người khác.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return true;
}

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

  // 1. Verify Active Employment if student is assigned
  let employment = null;
  if (studentUserId) {
    employment = await Employment.findOne({
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

    // 3. Strict Shift Overlap Conflict Check
    const conflictFilter = {
      studentUserId: studentUserId,
      scheduleStatus: { $ne: SCHEDULE_STATUSES.CANCELLED },
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
  }

  return { employment };
}

/**
 * Create a shift (draft or published)
 */
export async function createShift(data, actor) {
  const {
    studentUserId,
    jobId,
    date,
    startTime,
    endTime,
    role,
    wageRate,
    isDraft = false,
    shiftTemplateId = null,
  } = data;

  if (!jobId || !date || !startTime || !endTime) {
    const err = new Error('Vui lòng cung cấp đầy đủ thông tin ca làm việc (jobId, ngày, giờ bắt đầu, kết thúc).');
    err.code = 'MISSING_FIELDS';
    err.status = 400;
    throw err;
  }

  const job = await Job.findById(jobId);
  if (!job) {
    const err = new Error('Không tìm thấy thông tin công việc/cơ sở tuyển dụng.');
    err.code = 'JOB_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const actorIdStr = String(actor._id || actor.id);
  const jobEmployerIdStr = String(job.employerId?._id || job.employerId);
  if (actor.role !== 'admin' && actorIdStr !== jobEmployerIdStr) {
    const err = new Error('Bạn không có quyền tạo ca làm việc cho cơ sở này.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const isOvernight = endTime <= startTime;
  const startAt = parseVietnamDateTime(date, startTime, false);
  const endAt = parseVietnamDateTime(date, endTime, isOvernight);

  const { employment } = await validateShiftEligibilityAndConflict({
    studentUserId,
    employerUserId: job.employerId,
    startAt,
    endAt,
  });

  const diffHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
  const hours = Math.round(diffHours * 100) / 100;
  const rate = Number(wageRate) || job.salaryAmount || 25000;

  const scheduleStatus = isDraft ? SCHEDULE_STATUSES.DRAFT : SCHEDULE_STATUSES.PUBLISHED;
  const assignmentStatus = studentUserId ? ASSIGNMENT_STATUSES.ASSIGNED : ASSIGNMENT_STATUSES.UNASSIGNED;

  let studentUser = null;
  if (studentUserId) {
    studentUser = await User.findById(studentUserId);
  }

  const shift = await Shift.create({
    jobId: job._id,
    employmentId: employment?._id || null,
    shiftTemplateId,
    storeName: job.storeName || job.title,
    employerUserId: job.employerId,
    employerId: job.employerId,
    studentUserId: studentUserId || null,
    studentId: studentUserId || null,
    studentName: studentUser?.name || data.studentName || '',
    studentPhone: studentUser?.phone || data.studentPhone || '',
    role: role || 'Nhân viên bán ca',
    date,
    startTime,
    endTime,
    hours,
    wageRate: rate,
    startAt,
    endAt,
    scheduleStatus,
    assignmentStatus,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
    scheduleRevision: 1,
    publishedAt: isDraft ? null : new Date(),
    publishedBy: isDraft ? null : actor._id,
    wageSnapshot: {
      hourlyRate: rate,
      estimatedHours: hours,
      estimatedPay: hours * rate,
    },
    history: [
      {
        status: scheduleStatus,
        scheduleStatus,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
        changedAt: new Date(),
        changedBy: actor._id,
        note: isDraft ? 'Tạo ca làm việc nháp' : 'Tạo và công bố ca làm việc',
      },
    ],
  });

  // Notify student if published immediately
  if (!isDraft && studentUserId) {
    try {
      await Notification.create({
        userId: studentUserId,
        title: 'Ca làm việc mới được công bố 📅',
        message: `Bạn đã được xếp ca làm ngày ${date} (${startTime} - ${endTime}) tại ${shift.storeName}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to send shift notification:', notifErr.message);
    }
  }

  return { shift: { ...shift.toObject(), id: shift._id } };
}

/**
 * Preflight conflict validation before publishing shifts
 */
export async function preflightPublish({ employerId, startDate, endDate, shiftIds }) {
  const filter = {
    employerUserId: employerId,
    scheduleStatus: SCHEDULE_STATUSES.DRAFT,
  };

  if (Array.isArray(shiftIds) && shiftIds.length > 0) {
    filter._id = { $in: shiftIds };
  } else if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  }

  const draftShifts = await Shift.find(filter).lean();
  const errors = [];
  const warnings = [];
  const affectedEmployeeMap = new Map();

  for (const shift of draftShifts) {
    if (!shift.studentUserId) {
      warnings.push({
        shiftId: shift._id,
        code: 'UNASSIGNED_SHIFT',
        message: `Ca làm ngày ${shift.date} (${shift.startTime}-${shift.endTime}) chưa được gán nhân viên.`,
      });
      continue;
    }

    affectedEmployeeMap.set(String(shift.studentUserId), shift.studentName || 'Nhân viên');

    // Fetch existing published shifts & time-offs for this employee
    const [existingShifts, timeOffs] = await Promise.all([
      Shift.find({
        studentUserId: shift.studentUserId,
        _id: { $ne: shift._id },
        scheduleStatus: { $ne: SCHEDULE_STATUSES.CANCELLED },
      }).lean(),
      TimeOffRequest.find({
        employeeUserId: shift.studentUserId,
        status: { $in: ['pending', 'approved'] },
      }).lean(),
    ]);

    const evalResult = evaluateSchedulingPolicies({
      shift,
      existingShifts,
      timeOffRequests: timeOffs,
    });

    if (evalResult.errors.length > 0) {
      errors.push(...evalResult.errors.map((e) => ({ ...e, shiftId: shift._id, date: shift.date })));
    }
    if (evalResult.warnings.length > 0) {
      warnings.push(...evalResult.warnings.map((w) => ({ ...w, shiftId: shift._id, date: shift.date })));
    }
  }

  return {
    shiftsToPublish: draftShifts.length,
    affectedEmployees: Array.from(affectedEmployeeMap.entries()).map(([id, name]) => ({ id, name })),
    errors,
    warnings,
  };
}

/**
 * Bulk Publish draft shifts
 */
export async function publishShifts({ employerId, startDate, endDate, shiftIds, actor }) {
  const filter = {
    employerUserId: employerId,
    scheduleStatus: SCHEDULE_STATUSES.DRAFT,
  };

  if (Array.isArray(shiftIds) && shiftIds.length > 0) {
    filter._id = { $in: shiftIds };
  } else if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  }

  const drafts = await Shift.find(filter);
  if (drafts.length === 0) {
    return { publishedCount: 0, message: 'Không có ca nháp nào cần công bố.' };
  }

  const publishedShifts = [];
  const studentIdsToNotify = new Set();

  for (const shift of drafts) {
    assertCanTransition('schedule', shift.scheduleStatus, SCHEDULE_STATUSES.PUBLISHED);

    shift.scheduleStatus = SCHEDULE_STATUSES.PUBLISHED;
    shift.publishedAt = new Date();
    shift.publishedBy = actor?._id || employerId;
    shift.history.push({
      status: SCHEDULE_STATUSES.PUBLISHED,
      scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
      attendanceStatus: shift.attendanceStatus,
      payrollStatus: shift.payrollStatus,
      changedAt: new Date(),
      changedBy: actor?._id || employerId,
      note: 'Công bố lịch làm việc chính thức',
    });

    await shift.save();
    publishedShifts.push(shift);

    if (shift.studentUserId) {
      studentIdsToNotify.add(String(shift.studentUserId));
    }
  }

  // Send batch notifications
  for (const studentId of studentIdsToNotify) {
    try {
      await Notification.create({
        userId: studentId,
        title: 'Lịch làm việc mới đã được công bố 📢',
        message: 'Quản lý vừa công bố lịch làm việc mới. Vui lòng vào kiểm tra và xác nhận nhận ca.',
        type: 'shift',
        link: '/student/shifts',
      });
    } catch (notifErr) {
      console.warn('Failed to notify student:', notifErr.message);
    }
  }

  return { publishedCount: publishedShifts.length, shifts: publishedShifts };
}

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

/**
 * Generate draft shifts from ShiftTemplate
 */
export async function generateDraftShiftsFromTemplates({ employerId, startDate, endDate, jobId }) {
  const filter = { employerUserId: employerId, isActive: true };
  if (jobId) {
    filter.jobId = jobId;
  }

  const templates = await ShiftTemplate.find(filter).populate('jobId');
  if (templates.length === 0) {
    return { generatedCount: 0, message: 'Chưa có mẫu ca làm định kỳ nào được kích hoạt.' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const createdShifts = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon ...
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNum}`;

    const matchingTemplates = templates.filter((t) => t.dayOfWeek === dayOfWeek);

    for (const tmpl of matchingTemplates) {
      // Check if draft or published shift already exists for this template & date
      const existing = await Shift.findOne({
        shiftTemplateId: tmpl._id,
        date: dateStr,
        scheduleStatus: { $ne: SCHEDULE_STATUSES.CANCELLED },
      });

      if (!existing) {
        const isOvernight = tmpl.endTime <= tmpl.startTime;
        const startAt = parseVietnamDateTime(dateStr, tmpl.startTime, false);
        const endAt = parseVietnamDateTime(dateStr, tmpl.endTime, isOvernight);
        const diffHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
        const hours = Math.round(diffHours * 100) / 100;
        const rate = tmpl.wageRate || tmpl.jobId?.salaryAmount || 25000;

        const newShift = await Shift.create({
          jobId: tmpl.jobId?._id || tmpl.jobId,
          shiftTemplateId: tmpl._id,
          storeName: tmpl.jobId?.storeName || tmpl.name || 'Cửa hàng',
          employerUserId: employerId,
          employerId,
          studentUserId: tmpl.defaultEmployeeUserId || null,
          studentId: tmpl.defaultEmployeeUserId || null,
          role: tmpl.role || 'Nhân viên bán ca',
          date: dateStr,
          startTime: tmpl.startTime,
          endTime: tmpl.endTime,
          hours,
          wageRate: rate,
          startAt,
          endAt,
          scheduleStatus: SCHEDULE_STATUSES.DRAFT,
          assignmentStatus: tmpl.defaultEmployeeUserId ? ASSIGNMENT_STATUSES.ASSIGNED : ASSIGNMENT_STATUSES.UNASSIGNED,
          attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
          payrollStatus: PAYROLL_STATUSES.NOT_READY,
          scheduleRevision: 1,
          wageSnapshot: {
            hourlyRate: rate,
            estimatedHours: hours,
            estimatedPay: hours * rate,
          },
        });
        createdShifts.push(newShift);
      }
    }
  }

  return { generatedCount: createdShifts.length, shifts: createdShifts };
}
