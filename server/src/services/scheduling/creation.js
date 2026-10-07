import mongoose from 'mongoose';
import { Shift, parseVietnamDateTime } from '../../models/Shift.js';
import { Employment } from '../../models/Employment.js';
import { User } from '../../models/User.js';
import { EmployerProfile } from '../../models/EmployerProfile.js';
import { Notification } from '../../models/Notification.js';
import { ShiftTemplate } from '../../models/ShiftTemplate.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
} from '../../domain/shiftLifecycle.js';
import { validateShiftEligibilityAndConflict } from './eligibility.js';

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
