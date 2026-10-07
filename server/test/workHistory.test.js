import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWorkHistory } from '../src/services/workHistoryService.js';

const startAt = new Date('2026-10-01T11:00:00Z');
const approved = (extra = {}) => ({
  attendanceStatus: 'approved', workedMinutes: 240, employerUserId: 'e1', positionTitle: 'Pha chế', startAt,
  attendance: { checkInAt: new Date('2026-10-01T10:58:00Z') }, ...extra,
});

test('summarizes completed shifts, punctuality, attendance and reputation', () => {
  const summary = summarizeWorkHistory([
    approved(),
    approved({ employerUserId: 'e2', attendance: { checkInAt: new Date('2026-10-01T11:30:00Z') } }),
    approved({ workedMinutes: 90, positionTitle: 'Phục vụ', attendance: {} }),
    { attendanceStatus: 'no_show', startAt },
    { attendanceStatus: 'checked_in', startAt },
  ], { reputationScore: 4.6, reputationCount: 5 });

  assert.equal(summary.completedShifts, 3);
  assert.equal(summary.noShows, 1);
  assert.equal(summary.totalHours, 9.5);
  assert.equal(summary.storesWorkedAt, 2);
  assert.equal(summary.onTimeRate, 50); // 1 of 2 shifts with a check-in time
  assert.equal(summary.attendanceRate, 75);
  assert.deepEqual(summary.topRoles[0], { title: 'Pha chế', count: 2 });
  assert.equal(summary.reputationScore, 4.6);
  assert.equal(summary.reputationCount, 5);
});

test('empty history yields null rates instead of dividing by zero', () => {
  const summary = summarizeWorkHistory([], {});
  assert.equal(summary.completedShifts, 0);
  assert.equal(summary.onTimeRate, null);
  assert.equal(summary.attendanceRate, null);
  assert.equal(summary.reputationScore, null);
});
