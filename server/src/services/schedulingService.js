import mongoose from 'mongoose';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
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
  if (['student', 'worker', 'freelancer'].includes(actor.role)) {
    const err = new Error('Người lao động không có quyền thực hiện thao tác quản lý lịch và chấm công.');
    err.status = 403;
    err.code = 'FORBIDDEN';
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
 * Strict Authorization Assertion: Assigned Student / Employee (Read-only access)
 */
export function assertIsAssignedStudent(shift, actor) {
  if (!actor) {
    const err = new Error('Yêu cầu xác thực tài khoản.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const actorIdStr = String(actor._id || actor.id);
  const employeeUserIdStr = String(shift.employeeUserId?._id || shift.employeeUserId || shift.studentUserId?._id || shift.studentUserId || shift.studentId || '');

  if (actorIdStr !== employeeUserIdStr) {
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

  // 1. Verify Active Employment if employee is assigned
  let employment = null;
  if (studentUserId) {
    employment = await Employment.findOne({
      employeeUserId: studentUserId,
      employerUserId: employerUserId,
      status: 'active',
    });

    if (!employment) {
      const err = new Error('Nhân viên không có quan hệ việc làm đang hoạt động (active employment) tại cơ sở này.');
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
      const err = new Error('Nhân viên đã được duyệt nghỉ phép trong khoảng thời gian này.');
      err.code = 'TIME_OFF_CONFLICT';
      err.status = 409;
      throw err;
    }

    // 3. Strict Shift Overlap Conflict Check
    const conflictFilter = {
      $or: [
        { employeeUserId: studentUserId },
        { studentUserId: studentUserId },
      ],
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
      const conflictRole = conflictingShift.positionTitle || conflictingShift.role || 'Ca làm';

      const err = new Error(
        `Xung đột lịch làm việc! Nhân viên đã có ca "${conflictRole}" vào ngày ${conflictDate} (${conflictStart} - ${conflictEnd}). Không thể xếp 2 ca trùng giờ.`
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
 * Create a shift (draft or published) - decoupled from Job, based on active Employment
 */
export async function createShift(data, actor) {
  const {
    employmentId,
    studentUserId,
    employeeUserId,
    jobId,
    date,
    startTime,
    endTime,
    role,
    positionTitle,
    wageRate,
    isDraft = false,
    shiftTemplateId = null,
  } = data;

  if (!date || !startTime || !endTime) {
    const err = new Error('Vui lòng cung cấp đầy đủ thông tin ca làm việc (ngày, giờ bắt đầu, giờ kết thúc).');
    err.code = 'MISSING_FIELDS';
    err.status = 400;
    throw err;
  }

  // 1. Resolve Employment
  let employment = null;
  const targetEmployeeId = employeeUserId || studentUserId;

  if (employmentId && mongoose.Types.ObjectId.isValid(employmentId)) {
    employment = await Employment.findById(employmentId);
  } else if (targetEmployeeId) {
    employment = await Employment.findOne({
      employerUserId: actor._id,
      employeeUserId: targetEmployeeId,
      status: 'active',
    });

    if (!employment && mongoose.Types.ObjectId.isValid(targetEmployeeId)) {
      const employeeUser = await User.findById(targetEmployeeId);
      if (employeeUser) {
        let workplaceName = '';
        const employerProfile = await EmployerProfile.findOne({ userId: actor._id });
        workplaceName = employerProfile?.storeName || 'Cơ sở làm việc';
        employment = await Employment.findOne({
          employerUserId: actor._id,
          employeeUserId: targetEmployeeId,
        });
        if (employment) {
          employment.status = 'active';
          await employment.save();
        } else {
          employment = await Employment.create({
            employerUserId: actor._id,
            employeeUserId: targetEmployeeId,
            positionTitle: positionTitle || role || 'Nhân viên bán ca',
            workplace: workplaceName,
            wageRate: wageRate || 25000,
            status: 'active',
            startDate: new Date(),
          });
        }
      }
    }
  }

  if (!employment) {
    const err = new Error('Vui lòng chọn nhân viên đang làm việc (Employment) để xếp ca.');
    err.code = 'EMPLOYMENT_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const actorIdStr = String(actor._id || actor.id);
  const empEmployerIdStr = String(employment.employerUserId);
  if (actor.role !== 'admin' && actorIdStr !== empEmployerIdStr) {
    const err = new Error('Bạn không có quyền tạo ca làm việc cho nhân viên của cơ sở khác.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (employment.status !== 'active') {
    const err = new Error('Chỉ có thể xếp ca cho nhân viên đang ở trạng thái làm việc (active).');
    err.code = 'EMPLOYMENT_INACTIVE';
    err.status = 400;
    throw err;
  }

  const isOvernight = endTime <= startTime;
  const startAt = parseVietnamDateTime(date, startTime, false);
  const endAt = parseVietnamDateTime(date, endTime, isOvernight);

  await validateShiftEligibilityAndConflict({
    studentUserId: employment.employeeUserId,
    employerUserId: actor._id,
    startAt,
    endAt,
  });

  const diffHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
  const hours = Math.round(diffHours * 100) / 100;

  // Snapshot store name from Employment.workplace, or fallback to EmployerProfile
  let workplaceName = employment.workplace || '';
  if (!workplaceName) {
    const employerProfile = await EmployerProfile.findOne({ userId: actor._id });
    workplaceName = employerProfile?.storeName || 'Cơ sở làm việc';
  }

  const position = String(positionTitle || role || employment.positionTitle || 'Nhân viên bán ca').trim();
  const rate = Number(wageRate) > 0 ? Number(wageRate) : (employment.wageRate || 25000);

  const employeeUser = await User.findById(employment.employeeUserId);

  const scheduleStatus = isDraft ? SCHEDULE_STATUSES.DRAFT : SCHEDULE_STATUSES.PUBLISHED;
  const assignmentStatus = ASSIGNMENT_STATUSES.ASSIGNED;

  const shift = await Shift.create({
    employmentId: employment._id,
    jobId: employment.jobId || (jobId && mongoose.Types.ObjectId.isValid(jobId) ? jobId : null),
    shiftTemplateId,
    storeName: workplaceName,
    workplaceName,
    employerUserId: actor._id,
    employerId: actor._id,
    employeeUserId: employment.employeeUserId,
    employeeName: employeeUser?.name || '',
    studentUserId: employment.employeeUserId,
    studentId: employment.employeeUserId,
    studentName: employeeUser?.name || '',
    studentPhone: employeeUser?.phone || '',
    role: position,
    positionTitle: position,
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
        status: isDraft ? 'draft' : 'published',
        scheduleStatus,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
        changedAt: new Date(),
        changedBy: actor._id,
        note: isDraft ? 'Tạo ca làm việc nháp' : 'Tạo và công bố ca làm việc',
      },
    ],
  });

  // Notify employee if published immediately
  if (!isDraft) {
    try {
      await Notification.create({
        userId: employment.employeeUserId,
        title: 'Ca làm việc mới được công bố 📅',
        message: `Bạn đã được xếp ca làm ngày ${date} (${startTime} - ${endTime}) tại ${workplaceName}.`,
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
  const filter = {
    employerUserId: employerId,
    $or: [{ active: true }, { isActive: true }],
  };
  if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
    filter.jobId = jobId;
  }

  const templates = await ShiftTemplate.find(filter).lean();
  if (templates.length === 0) {
    return { generatedCount: 0, message: 'Chưa có mẫu ca làm định kỳ nào được kích hoạt.' };
  }

  const employerProfile = await EmployerProfile.findOne({ userId: employerId });
  const defaultStoreName = employerProfile?.storeName || 'Cơ sở làm việc';

  const start = new Date(startDate);
  const end = new Date(endDate);
  const createdShifts = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon ...
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNum}`;

    const matchingTemplates = templates.filter((t) => {
      if (t.dayOfWeek !== dayOfWeek) return false;
      if (t.effectiveFrom && new Date(t.effectiveFrom) > d) return false;
      if (t.effectiveTo && new Date(t.effectiveTo) < d) return false;
      return true;
    });

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
        const rate = tmpl.wageOverride || tmpl.wageRate || 25000;
        const workplace = tmpl.workplace || defaultStoreName;
        const position = tmpl.positionTitle || tmpl.role || 'Nhân viên bán ca';

        const newShift = await Shift.create({
          jobId: tmpl.jobId || null,
          shiftTemplateId: tmpl._id,
          storeName: workplace,
          workplaceName: workplace,
          employerUserId: employerId,
          employerId,
          studentUserId: tmpl.defaultEmployeeUserId || null,
          studentId: tmpl.defaultEmployeeUserId || null,
          employeeUserId: tmpl.defaultEmployeeUserId || null,
          role: position,
          positionTitle: position,
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
