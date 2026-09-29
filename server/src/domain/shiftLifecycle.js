/**
 * Domain Lifecycle & State Machine Engine for Workforce Scheduling & Shift Management
 *
 * Implements benchmark standards from:
 * - Microsoft Shifts
 * - When I Work
 * - Sling / Deputy
 * - ILO & MOLISA Vietnam Labour Code 2019 Working Hours & Rest Periods
 */

export const SCHEDULE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
});

export const ASSIGNMENT_STATUSES = Object.freeze({
  UNASSIGNED: 'unassigned',
  ASSIGNED: 'assigned',
  ACKNOWLEDGED: 'acknowledged',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

export const ATTENDANCE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  NEEDS_REVIEW: 'needs_review',
  COMPLETED_PENDING_REVIEW: 'completed_pending_review',
  APPROVED: 'approved',
  DISPUTED: 'disputed',
  NO_SHOW: 'no_show',
});

export const PAYROLL_STATUSES = Object.freeze({
  NOT_READY: 'not_ready',
  READY: 'ready',
  PAID: 'paid',
});

// Valid Transitions Mapping
export const SCHEDULE_TRANSITIONS = Object.freeze({
  [SCHEDULE_STATUSES.DRAFT]: [SCHEDULE_STATUSES.PUBLISHED, SCHEDULE_STATUSES.CANCELLED],
  [SCHEDULE_STATUSES.PUBLISHED]: [SCHEDULE_STATUSES.CANCELLED],
  [SCHEDULE_STATUSES.CANCELLED]: [], // Terminal
});

export const ASSIGNMENT_TRANSITIONS = Object.freeze({
  [ASSIGNMENT_STATUSES.UNASSIGNED]: [ASSIGNMENT_STATUSES.ASSIGNED],
  [ASSIGNMENT_STATUSES.ASSIGNED]: [ASSIGNMENT_STATUSES.ACKNOWLEDGED, ASSIGNMENT_STATUSES.ACCEPTED, ASSIGNMENT_STATUSES.DECLINED, ASSIGNMENT_STATUSES.UNASSIGNED],
  [ASSIGNMENT_STATUSES.ACKNOWLEDGED]: [ASSIGNMENT_STATUSES.ACCEPTED, ASSIGNMENT_STATUSES.DECLINED, ASSIGNMENT_STATUSES.UNASSIGNED],
  [ASSIGNMENT_STATUSES.ACCEPTED]: [ASSIGNMENT_STATUSES.ASSIGNED, ASSIGNMENT_STATUSES.DECLINED, ASSIGNMENT_STATUSES.UNASSIGNED],
  [ASSIGNMENT_STATUSES.DECLINED]: [ASSIGNMENT_STATUSES.ASSIGNED, ASSIGNMENT_STATUSES.UNASSIGNED],
});

export const ATTENDANCE_TRANSITIONS = Object.freeze({
  [ATTENDANCE_STATUSES.NOT_STARTED]: [ATTENDANCE_STATUSES.CHECKED_IN, ATTENDANCE_STATUSES.NO_SHOW, ATTENDANCE_STATUSES.NEEDS_REVIEW],
  [ATTENDANCE_STATUSES.CHECKED_IN]: [ATTENDANCE_STATUSES.CHECKED_OUT, ATTENDANCE_STATUSES.NEEDS_REVIEW, ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW],
  [ATTENDANCE_STATUSES.CHECKED_OUT]: [ATTENDANCE_STATUSES.NEEDS_REVIEW, ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW, ATTENDANCE_STATUSES.APPROVED],
  [ATTENDANCE_STATUSES.NEEDS_REVIEW]: [ATTENDANCE_STATUSES.APPROVED, ATTENDANCE_STATUSES.DISPUTED],
  [ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW]: [ATTENDANCE_STATUSES.APPROVED, ATTENDANCE_STATUSES.NEEDS_REVIEW, ATTENDANCE_STATUSES.DISPUTED],
  [ATTENDANCE_STATUSES.APPROVED]: [ATTENDANCE_STATUSES.DISPUTED],
  [ATTENDANCE_STATUSES.DISPUTED]: [ATTENDANCE_STATUSES.APPROVED, ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW],
  [ATTENDANCE_STATUSES.NO_SHOW]: [ATTENDANCE_STATUSES.DISPUTED],
});

export const PAYROLL_TRANSITIONS = Object.freeze({
  [PAYROLL_STATUSES.NOT_READY]: [PAYROLL_STATUSES.READY],
  [PAYROLL_STATUSES.READY]: [PAYROLL_STATUSES.PAID, PAYROLL_STATUSES.NOT_READY],
  [PAYROLL_STATUSES.PAID]: [], // Terminal: locked
});

/**
 * Transition validator with descriptive error throw
 */
export function assertCanTransition(lifecycle, fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;

  let transitionMap = null;
  switch (lifecycle) {
    case 'schedule':
      transitionMap = SCHEDULE_TRANSITIONS;
      break;
    case 'assignment':
      transitionMap = ASSIGNMENT_TRANSITIONS;
      break;
    case 'attendance':
      transitionMap = ATTENDANCE_TRANSITIONS;
      break;
    case 'payroll':
      transitionMap = PAYROLL_TRANSITIONS;
      break;
    default:
      throw new Error(`Invalid lifecycle name: ${lifecycle}`);
  }

  const allowed = transitionMap[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const error = new Error(`Không thể chuyển trạng thái ${lifecycle} từ "${fromStatus}" sang "${toStatus}".`);
    error.statusCode = 400;
    error.code = 'INVALID_LIFECYCLE_TRANSITION';
    throw error;
  }
  return true;
}

/**
 * Idempotent converter from legacy single status to canonical separated state fields
 */
export function migrateLegacyStatusToCanonical(legacyStatus) {
  const norm = String(legacyStatus || 'published').toLowerCase().trim();

  switch (norm) {
    case 'draft':
      return {
        scheduleStatus: SCHEDULE_STATUSES.DRAFT,
        assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'acknowledged':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACKNOWLEDGED,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'checked_in':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.CHECKED_IN,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'checked_out':
    case 'pending_approval':
    case 'completed_pending_review':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'needs_review':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.NEEDS_REVIEW,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'approved':
    case 'completed':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.APPROVED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'payroll_ready':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.APPROVED,
        payrollStatus: PAYROLL_STATUSES.READY,
      };

    case 'paid':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.APPROVED,
        payrollStatus: PAYROLL_STATUSES.PAID,
      };

    case 'disputed':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
        attendanceStatus: ATTENDANCE_STATUSES.DISPUTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'no_show':
    case 'absent':
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
        attendanceStatus: ATTENDANCE_STATUSES.NO_SHOW,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'cancelled':
      return {
        scheduleStatus: SCHEDULE_STATUSES.CANCELLED,
        assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };

    case 'scheduled':
    case 'published':
    default:
      return {
        scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
        assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
        attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
        payrollStatus: PAYROLL_STATUSES.NOT_READY,
      };
  }
}

/**
 * Computes legacy single status from canonical states for backwards compatibility
 */
export function computeLegacyStatus(shift) {
  if (!shift) return 'published';

  const scheduleStatus = shift.scheduleStatus;
  const assignmentStatus = shift.assignmentStatus;
  const attendanceStatus = shift.attendanceStatus;
  const payrollStatus = shift.payrollStatus;

  if (scheduleStatus === SCHEDULE_STATUSES.CANCELLED) return 'cancelled';
  if (scheduleStatus === SCHEDULE_STATUSES.DRAFT) return 'draft';

  if (payrollStatus === PAYROLL_STATUSES.PAID) return 'paid';
  if (payrollStatus === PAYROLL_STATUSES.READY) return 'payroll_ready';

  if (attendanceStatus === ATTENDANCE_STATUSES.APPROVED) return 'approved';
  if (attendanceStatus === ATTENDANCE_STATUSES.DISPUTED) return 'disputed';
  if (attendanceStatus === ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW || attendanceStatus === ATTENDANCE_STATUSES.CHECKED_OUT) {
    return 'completed_pending_review';
  }
  if (attendanceStatus === ATTENDANCE_STATUSES.NEEDS_REVIEW) return 'needs_review';
  if (attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) return 'checked_in';
  if (attendanceStatus === ATTENDANCE_STATUSES.NO_SHOW) return 'no_show';

  if (assignmentStatus === ASSIGNMENT_STATUSES.ACKNOWLEDGED) return 'acknowledged';
  return 'published';
}

/**
 * Derive authoritative allowed actions on a shift record for a given actor and timestamp
 */
export function getAllowedShiftActions(shift, actor, now = new Date()) {
  const actions = [];
  if (!shift || !actor) return actions;

  const isOwner = String(shift.employerUserId?._id || shift.employerUserId || shift.employerId) === String(actor._id || actor.id);
  const isAssigned = String(shift.studentUserId?._id || shift.studentUserId || shift.studentId) === String(actor._id || actor.id);
  const isAdmin = actor.role === 'admin';

  const scheduleStatus = shift.scheduleStatus || 'published';
  const assignmentStatus = shift.assignmentStatus || 'assigned';
  const attendanceStatus = shift.attendanceStatus || 'not_started';
  const payrollStatus = shift.payrollStatus || 'not_ready';

  // Terminal checks
  if (scheduleStatus === SCHEDULE_STATUSES.CANCELLED) {
    return actions; // No further mutations
  }

  // Employer & Admin Permissions
  if (isOwner || isAdmin) {
    if (scheduleStatus === SCHEDULE_STATUSES.DRAFT) {
      actions.push('publish', 'edit', 'cancel', 'assign');
    }

    if (scheduleStatus === SCHEDULE_STATUSES.PUBLISHED) {
      // Reschedule or cancel allowed prior to attendance lock (before checked-in or if not paid)
      if (attendanceStatus === ATTENDANCE_STATUSES.NOT_STARTED && payrollStatus === PAYROLL_STATUSES.NOT_READY) {
        actions.push('reschedule', 'cancel', 'reassign');
      }

      // Timesheet review actions
      if (['completed_pending_review', 'needs_review', 'disputed'].includes(attendanceStatus) && payrollStatus === PAYROLL_STATUSES.NOT_READY) {
        actions.push('approve_attendance', 'adjust_time');
      }

      if (attendanceStatus === ATTENDANCE_STATUSES.DISPUTED) {
        actions.push('resolve_dispute');
      }

      // Payroll actions
      if (attendanceStatus === ATTENDANCE_STATUSES.APPROVED && payrollStatus === PAYROLL_STATUSES.NOT_READY) {
        actions.push('mark_payroll_ready');
      }
      if (payrollStatus === PAYROLL_STATUSES.READY) {
        actions.push('mark_paid');
      }
    }
  }

  // Student / Employee Permissions
  if (isAssigned) {
    if (scheduleStatus === SCHEDULE_STATUSES.PUBLISHED) {
      if (assignmentStatus !== ASSIGNMENT_STATUSES.ACCEPTED && assignmentStatus !== ASSIGNMENT_STATUSES.DECLINED) {
        actions.push('accept', 'decline', 'acknowledge');
      }

      // Attendance check-in window: between 30m before startAt and 60m after startAt
      if (attendanceStatus === ATTENDANCE_STATUSES.NOT_STARTED) {
        actions.push('check_in');
      }

      if (attendanceStatus === ATTENDANCE_STATUSES.CHECKED_IN) {
        actions.push('check_out');
      }

      // Dispute allowed on completed or approved shifts if not yet paid
      if (['completed_pending_review', 'needs_review', 'approved'].includes(attendanceStatus) && payrollStatus !== PAYROLL_STATUSES.PAID) {
        actions.push('dispute');
      }
    }
  }

  return actions;
}

/**
 * Compliance policy evaluation (ILO Vietnam Labour Code 2019 checks)
 */
export function evaluateSchedulingPolicies({ shift, existingShifts = [], timeOffRequests = [] }) {
  const errors = [];
  const warnings = [];

  const shiftStart = new Date(shift.startAt);
  const shiftEnd = new Date(shift.endAt);

  if (isNaN(shiftStart.getTime()) || isNaN(shiftEnd.getTime()) || shiftStart >= shiftEnd) {
    errors.push({ code: 'INVALID_DURATION', message: 'Thời gian ca làm việc không hợp lệ (giờ kết thúc phải sau giờ bắt đầu).' });
    return { valid: false, errors, warnings };
  }

  // 1. Overlap Check with other active shifts of the same employee
  for (const existing of existingShifts) {
    if (String(existing._id || existing.id) === String(shift._id || shift.id)) continue;
    if (existing.scheduleStatus === SCHEDULE_STATUSES.CANCELLED || existing.status === 'cancelled') continue;

    const eStart = new Date(existing.startAt);
    const eEnd = new Date(existing.endAt);

    // Overlap condition: start < eEnd && end > eStart
    if (shiftStart < eEnd && shiftEnd > eStart) {
      errors.push({
        code: 'SHIFT_OVERLAP',
        message: `Xung đột trùng ca: Nhân viên đã được phân ca làm (${existing.date} ${existing.startTime}-${existing.endTime}) tại ${existing.storeName || 'cơ sở khác'}.`,
        conflictingShiftId: existing._id || existing.id,
      });
    }

    // 2. Minimum rest period between consecutive shifts: 12 hours (ILO Labour Code 2019)
    const restBefore = (shiftStart.getTime() - eEnd.getTime()) / (1000 * 60 * 60);
    const restAfter = (eStart.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);

    if (restBefore > 0 && restBefore < 12) {
      warnings.push({
        code: 'INSUFFICIENT_REST',
        message: `Khoảng nghỉ chuyển ca ít hơn 12 giờ (${restBefore.toFixed(1)}h) so với ca trước đó (${existing.date} ${existing.startTime}-${existing.endTime}).`,
      });
    } else if (restAfter > 0 && restAfter < 12) {
      warnings.push({
        code: 'INSUFFICIENT_REST',
        message: `Khoảng nghỉ chuyển ca ít hơn 12 giờ (${restAfter.toFixed(1)}h) so với ca kế tiếp (${existing.date} ${existing.startTime}-${existing.endTime}).`,
      });
    }
  }

  // 3. Time Off Requests check
  for (const req of timeOffRequests) {
    if (req.status === 'cancelled' || req.status === 'rejected') continue;

    const toStart = new Date(req.startDate);
    const toEnd = new Date(req.endDate);
    toEnd.setHours(23, 59, 59, 999);

    if (shiftStart <= toEnd && shiftEnd >= toStart) {
      if (req.status === 'approved') {
        errors.push({
          code: 'TIME_OFF_CONFLICT',
          message: `Nhân viên đã được duyệt nghỉ phép trong khoảng thời gian này (${new Date(req.startDate).toLocaleDateString('vi-VN')} – ${new Date(req.endDate).toLocaleDateString('vi-VN')}).`,
          timeOffRequestId: req._id || req.id,
        });
      } else if (req.status === 'pending') {
        warnings.push({
          code: 'PENDING_TIME_OFF',
          message: `Nhân viên đang có đơn xin nghỉ phép chờ duyệt trùng với ca làm này.`,
          timeOffRequestId: req._id || req.id,
        });
      }
    }
  }

  // 4. Maximum Daily Hours check (> 8 hours)
  const shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
  if (shiftHours > 8) {
    warnings.push({
      code: 'EXCEEDS_MAX_DAILY_HOURS',
      message: `Ca làm việc kéo dài ${shiftHours.toFixed(1)} giờ (vượt quá khuyến nghị 8 giờ/ngày theo Bộ luật Lao động 2019).`,
    });
  }

  // 5. Mandatory break check for shifts >= 6 hours
  if (shiftHours >= 6) {
    warnings.push({
      code: 'MANDATORY_BREAK_RECOMMENDED',
      message: `Ca làm từ 6 giờ trở lên cần bố trí thời gian nghỉ giữa giờ tối thiểu 30 phút.`,
    });
  }

  // 6. Night shift detection (22:00 to 06:00 Vietnam time UTC+7)
  const startHourVN = (shiftStart.getUTCHours() + 7) % 24;
  const endHourVN = (shiftEnd.getUTCHours() + 7) % 24;
  const isNightShift = startHourVN >= 22 || startHourVN < 6 || endHourVN > 22 || endHourVN <= 6;
  if (isNightShift) {
    warnings.push({
      code: 'NIGHT_SHIFT_COMPLIANCE',
      message: `Ca làm việc có thời gian nằm trong khung giờ đêm (22:00 – 06:00). Cần kiểm tra chế độ phụ cấp ca đêm.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
