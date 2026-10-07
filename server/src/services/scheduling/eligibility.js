import { Shift } from '../../models/Shift.js';
import { Employment } from '../../models/Employment.js';
import { TimeOffRequest } from '../../models/TimeOffRequest.js';
import { SCHEDULE_STATUSES } from '../../domain/shiftLifecycle.js';

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
