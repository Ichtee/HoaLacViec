import { Shift } from '../../models/Shift.js';
import { TimeOffRequest } from '../../models/TimeOffRequest.js';
import { Notification } from '../../models/Notification.js';
import { SCHEDULE_STATUSES, assertCanTransition, evaluateSchedulingPolicies } from '../../domain/shiftLifecycle.js';

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
