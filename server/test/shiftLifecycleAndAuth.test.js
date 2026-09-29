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

  const shift = {
    employerUserId: employerA._id,
    studentUserId: studentA._id,
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
  assert.throws(
    () => assertIsEmployerOwnerOrAdmin(shift, studentA),
    /Bạn không có quyền thao tác trên ca làm việc của cơ sở này/
  );

  // Student Assignment
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

test('Shift Domain: 4. Authoritative Allowed Actions Derivation', () => {
  const employer = { _id: 'emp1', role: 'employer' };
  const student = { _id: 'stu1', role: 'student' };
  const outsider = { _id: 'out1', role: 'student' };

  const draftShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
    scheduleStatus: SCHEDULE_STATUSES.DRAFT,
    assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
  };

  // Draft actions
  const empDraftActions = getAllowedShiftActions(draftShift, employer);
  assert.ok(empDraftActions.includes('publish'));
  assert.ok(empDraftActions.includes('edit'));

  const stuDraftActions = getAllowedShiftActions(draftShift, student);
  assert.equal(stuDraftActions.length, 0, 'Student has 0 actions on draft shifts');

  // Published Shift
  const pubShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
    scheduleStatus: SCHEDULE_STATUSES.PUBLISHED,
    assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
    attendanceStatus: ATTENDANCE_STATUSES.NOT_STARTED,
    payrollStatus: PAYROLL_STATUSES.NOT_READY,
  };

  const stuPubActions = getAllowedShiftActions(pubShift, student);
  assert.ok(stuPubActions.includes('accept'));
  assert.ok(stuPubActions.includes('decline'));
  assert.ok(stuPubActions.includes('check_in'));

  const outsiderActions = getAllowedShiftActions(pubShift, outsider);
  assert.equal(outsiderActions.length, 0, 'Unassigned outsider has no actions');

  // Cancelled Shift Terminal
  const cancelledShift = {
    employerUserId: 'emp1',
    studentUserId: 'stu1',
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
