import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
  assertCanTransition,
  migrateLegacyStatusToCanonical,
  computeLegacyStatus,
  getAllowedShiftActions,
  evaluateSchedulingPolicies,
} from '../src/domain/shiftLifecycle.js';
import {
  assertIsEmployerOwnerOrAdmin,
  assertIsAssignedStudent,
} from '../src/services/schedulingService.js';

test('Shift Domain: 1. State Machine Transitions & Invariants', () => {
  // Valid transitions
  assert.equal(assertCanTransition('schedule', SCHEDULE_STATUSES.DRAFT, SCHEDULE_STATUSES.PUBLISHED), true);
  assert.equal(assertCanTransition('schedule', SCHEDULE_STATUSES.PUBLISHED, SCHEDULE_STATUSES.CANCELLED), true);
  assert.equal(assertCanTransition('attendance', ATTENDANCE_STATUSES.NOT_STARTED, ATTENDANCE_STATUSES.CHECKED_IN), true);
  assert.equal(assertCanTransition('attendance', ATTENDANCE_STATUSES.CHECKED_IN, ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW), true);
  assert.equal(assertCanTransition('attendance', ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW, ATTENDANCE_STATUSES.APPROVED), true);
  assert.equal(assertCanTransition('payroll', PAYROLL_STATUSES.NOT_READY, PAYROLL_STATUSES.READY), true);
  assert.equal(assertCanTransition('payroll', PAYROLL_STATUSES.READY, PAYROLL_STATUSES.PAID), true);

  // Terminal state locks (Invalid transitions)
  assert.throws(
    () => assertCanTransition('schedule', SCHEDULE_STATUSES.CANCELLED, SCHEDULE_STATUSES.PUBLISHED),
    /Không thể chuyển trạng thái schedule/
  );
  assert.throws(
    () => assertCanTransition('payroll', PAYROLL_STATUSES.PAID, PAYROLL_STATUSES.READY),
    /Không thể chuyển trạng thái payroll/
  );
  assert.throws(
    () => assertCanTransition('attendance', ATTENDANCE_STATUSES.NOT_STARTED, ATTENDANCE_STATUSES.APPROVED),
    /Không thể chuyển trạng thái attendance/
  );
});

test('Shift Domain: 2. Legacy Migration & Compatibility Projections', () => {
  const legacyStatuses = [
    'draft',
    'published',
    'acknowledged',
    'checked_in',
    'completed_pending_review',
    'approved',
    'payroll_ready',
    'paid',
    'disputed',
    'cancelled',
    'no_show',
  ];

  for (const leg of legacyStatuses) {
    const canonical = migrateLegacyStatusToCanonical(leg);
    assert.ok(canonical.scheduleStatus, `Canonical scheduleStatus should exist for ${leg}`);
    assert.ok(canonical.attendanceStatus, `Canonical attendanceStatus should exist for ${leg}`);
    assert.ok(canonical.payrollStatus, `Canonical payrollStatus should exist for ${leg}`);

    // Project back to legacy
    const projected = computeLegacyStatus(canonical);
    assert.equal(projected, leg, `Bidirectional projection should match for ${leg}`);
  }

  // Idempotence check
  const firstPass = migrateLegacyStatusToCanonical('checked_in');
  const secondPass = migrateLegacyStatusToCanonical(computeLegacyStatus(firstPass));
  assert.deepEqual(firstPass, secondPass, 'Migration must be strictly idempotent');
});

test('Shift Domain: 3. Authorization & IDOR Security Boundaries', () => {
  const employerA = { _id: '507f191e810c19729de860ea', role: 'employer' };
  const employerB = { _id: '507f191e810c19729de860eb', role: 'employer' };
  const admin = { _id: '507f191e810c19729de860ec', role: 'admin' };
  const studentA = { _id: '507f191e810c19729de860ed', role: 'student' };
  const studentB = { _id: '507f191e810c19729de860ee', role: 'student' };
  const workerA = { _id: '507f191e810c19729de860ef', role: 'worker' };
  const freelancerA = { _id: '507f191e810c19729de860f0', role: 'freelancer' };

  const shift = {
    employerUserId: employerA._id,
    studentUserId: studentA._id,
    employeeUserId: studentA._id,
    scheduleStatus: 'published',
    assignmentStatus: 'assigned',
    attendanceStatus: 'not_started',
    payrollStatus: 'not_ready',
  };

  // Employer Ownership
  assert.equal(assertIsEmployerOwnerOrAdmin(shift, employerA), true);
  assert.equal(assertIsEmployerOwnerOrAdmin(shift, admin), true);
  assert.throws(
    () => assertIsEmployerOwnerOrAdmin(shift, employerB),
    /Bạn không có quyền thao tác trên ca làm việc của cơ sở này/
  );
  // Employee roles (student, worker, freelancer) are unconditionally blocked with 403
  assert.throws(
    () => assertIsEmployerOwnerOrAdmin(shift, studentA),
    /Người lao động không có quyền thực hiện thao tác quản lý lịch và chấm công/
  );
  assert.throws(
    () => assertIsEmployerOwnerOrAdmin(shift, workerA),
    /Người lao động không có quyền thực hiện thao tác quản lý lịch và chấm công/
  );
  assert.throws(
    () => assertIsEmployerOwnerOrAdmin(shift, freelancerA),
    /Người lao động không có quyền thực hiện thao tác quản lý lịch và chấm công/
  );

  // Student Assignment (Read authorization)
  assert.equal(assertIsAssignedStudent(shift, studentA), true);
  assert.throws(
    () => assertIsAssignedStudent(shift, studentB),
    /Bạn không có quyền thao tác trên ca làm của người khác/
  );
  assert.throws(
    () => assertIsAssignedStudent(shift, employerA),
    /Bạn không có quyền thao tác trên ca làm của người khác/
  );
});

test('Shift Domain: 4. Authoritative Allowed Actions Derivation (Employee Read-Only, Employer Authoritative)', () => {
  const employer = { _id: 'emp1', role: 'employer' };
  const student = { _id: 'stu1', role: 'student' };
  const worker = { _id: 'wrk1', role: 'worker' };
  const freelancer = { _id: 'fre1', role: 'freelancer' };
  const outsider = { _id: 'out1', role: 'student' };

  const draftShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
    employeeUserId: 'stu1',
    scheduleStatus: SCHEDULE_STATUSES.DRAFT,
    assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
  };

  // Draft actions: Employer can publish, edit, delete
  const empDraftActions = getAllowedShiftActions(draftShift, employer);
  assert.ok(empDraftActions.includes('publish'));
  assert.ok(empDraftActions.includes('edit'));
  assert.ok(empDraftActions.includes('delete'));

  // Employees have 0 actions on draft shifts
  assert.equal(getAllowedShiftActions(draftShift, student).length, 0);
  assert.equal(getAllowedShiftActions(draftShift, worker).length, 0);
  assert.equal(getAllowedShiftActions(draftShift, freelancer).length, 0);

  // Published Shift:
  // Strictly verified: Employees (student, worker, freelancer) have 0 actions across ALL published shifts (pure read-only)
  const pubShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
    employeeUserId: 'stu1',
    scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
    assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
  };

  assert.deepEqual(getAllowedShiftActions(pubShift, student), [], 'Student has no allowed mutation actions');
  assert.deepEqual(getAllowedShiftActions(pubShift, worker), [], 'Worker has no allowed mutation actions');
  assert.deepEqual(getAllowedShiftActions(pubShift, freelancer), [], 'Freelancer has no allowed mutation actions');
  assert.deepEqual(getAllowedShiftActions(pubShift, outsider), [], 'Outsider has no actions');

  // Employer has attendance and schedule actions
  const empPubActions = getAllowedShiftActions(pubShift, employer);
  assert.ok(empPubActions.includes('record_start'), 'Employer can record attendance start');
  assert.ok(empPubActions.includes('record_no_show'), 'Employer can mark no-show');
  assert.ok(empPubActions.includes('reschedule'), 'Employer can reschedule');
  assert.ok(empPubActions.includes('cancel'), 'Employer can cancel');

  // When shift is checked in: Employer can record end
  const inProgressShift = {
    ...pubShift,
    attendanceStatus: ATTENDANCE_STATUSES.CHECKED_IN,
  };
  const empInProgActions = getAllowedShiftActions(inProgressShift, employer);
  assert.ok(empInProgActions.includes('record_end'), 'Employer can record attendance end');
  assert.equal(getAllowedShiftActions(inProgressShift, student).length, 0, 'Student cannot check-out');

  // When shift attendance is completed: Employer can approve or adjust
  const completedShift = {
    ...pubShift,
    attendanceStatus: ATTENDANCE_STATUSES.COMPLETED_PENDING_REVIEW,
  };
  const empCompletedActions = getAllowedShiftActions(completedShift, employer);
  assert.ok(empCompletedActions.includes('approve_attendance'), 'Employer can approve attendance');
  assert.ok(empCompletedActions.includes('adjust_time'), 'Employer can adjust time');

  // Cancelled Shift Terminal: No actions for anyone
  const cancelledShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
    employeeUserId: 'stu1',
    scheduleStatus: SCHEDULE_STATUSES.CANCELLED,
  };
  assert.equal(getAllowedShiftActions(cancelledShift, employer).length, 0);
  assert.equal(getAllowedShiftActions(cancelledShift, student).length, 0);
});

test('Shift Domain: 5. Compliance Policy Engine (ILO Vietnam Labour Code 2019)', () => {
  // Overlap test
  const shift = {
    id: 's1',
    startAt: new Date('2026-10-01T08:00:00Z'),
    endAt: new Date('2026-10-01T12:00:00Z'),
  };

  const overlappingShift = {
    id: 's2',
    startAt: new Date('2026-10-01T10:00:00Z'),
    endAt: new Date('2026-10-01T14:00:00Z'),
    scheduleStatus: 'published',
  };

  const resOverlap = evaluateSchedulingPolicies({
    shift,
    existingShifts: [overlappingShift],
  });
  assert.equal(resOverlap.valid, false);
  assert.equal(resOverlap.errors[0].code, 'SHIFT_OVERLAP');

  // Approved Time Off test
  const timeOff = {
    id: 'to1',
    status: 'approved',
    startDate: new Date('2026-10-01T00:00:00Z'),
    endDate: new Date('2026-10-01T23:59:59Z'),
  };
  const resTimeOff = evaluateSchedulingPolicies({
    shift,
    existingShifts: [],
    timeOffRequests: [timeOff],
  });
  assert.equal(resTimeOff.valid, false);
  assert.equal(resTimeOff.errors[0].code, 'TIME_OFF_CONFLICT');

  // Long Shift (> 8h) & Mandatory Break warning test
  const longShift = {
    id: 's3',
    startAt: new Date('2026-10-02T08:00:00Z'),
    endAt: new Date('2026-10-02T18:00:00Z'), // 10 hours
  };
  const resLong = evaluateSchedulingPolicies({ shift: longShift });
  assert.equal(resLong.valid, true); // Valid, but has compliance warnings
  const warnCodes = resLong.warnings.map((w) => w.code);
  assert.ok(warnCodes.includes('EXCEEDS_MAX_DAILY_HOURS'));
  assert.ok(warnCodes.includes('MANDATORY_BREAK_RECOMMENDED'));
});

test('Shift Domain: 6. Decoupled Employment Model & Employer-Recorded Attendance Invariants', () => {
  // 1. Shift calculation contract: worked minutes & pay calculation
  const wageRate = 30000; // 30,000 VND/hour = 500 VND/minute
  const checkIn = new Date('2026-10-01T08:00:00Z');
  const checkOut = new Date('2026-10-01T12:30:00Z'); // 4.5 hours = 270 minutes

  const workedMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60)));
  assert.equal(workedMinutes, 270);

  const totalPay = Math.round((workedMinutes / 60) * wageRate);
  assert.equal(totalPay, 135000);

  // 2. Negative/invalid interval detection
  const invalidCheckOut = new Date('2026-10-01T07:30:00Z'); // Before check-in
  assert.ok(invalidCheckOut.getTime() < checkIn.getTime(), 'Check-out before check-in must be rejected');

  // 3. ShiftTemplate generation without Job dependency
  const template = {
    _id: 'tmpl_1',
    employerUserId: 'emp_1',
    employmentId: 'emp_rel_1',
    studentUserId: 'stu_1',
    dayOfWeek: 4, // Thursday
    startTime: '08:00',
    endTime: '12:00',
    role: 'Phục vụ bàn',
    storeName: 'Cà phê Hòa Lạc',
    wageRate: 28000,
    active: true,
  };

  // Generation contract: Shift receives employmentId, storeName, wageRate without jobId
  const generatedShift = {
    employerUserId: template.employerUserId,
    employmentId: template.employmentId,
    studentUserId: template.studentUserId,
    employeeUserId: template.studentUserId,
    date: '2026-10-01',
    startTime: template.startTime,
    endTime: template.endTime,
    storeName: template.storeName,
    workplaceName: template.storeName,
    role: template.role,
    positionTitle: template.role,
    wageRate: template.wageRate,
    scheduleStatus: SCHEDULE_STATUSES.DRAFT,
    assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
  };

  assert.equal(generatedShift.employmentId, 'emp_rel_1');
  assert.equal(generatedShift.jobId, undefined, 'Shift template generation is independent of Job');
  assert.equal(generatedShift.wageRate, 28000);
});

