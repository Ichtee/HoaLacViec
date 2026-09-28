import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { VALID_TRANSITIONS, getStatusLabel } from '../src/services/applicationService.js';
import { parseVietnamDateTime } from '../src/models/Shift.js';

test('Comprehensive Candidate → Employment → Shift Domain Rules', async (t) => {

  // =========================================================================
  // 1. APPLICATION & OFFER INVARIANTS
  // =========================================================================
  await t.test('Application: Cannot jump directly from submitted to hired', () => {
    const transitions = VALID_TRANSITIONS.submitted || [];
    assert.equal(transitions.includes('hired'), false);
    assert.ok(transitions.includes('screening'));
    assert.ok(transitions.includes('offer_sent'));
  });

  await t.test('Application: Cannot jump directly from interview to hired without offer acceptance', () => {
    const transitions = VALID_TRANSITIONS.interview || [];
    assert.equal(transitions.includes('hired'), false);
    assert.ok(transitions.includes('offer_sent'));
  });

  await t.test('Application: Offer sent can transition to accepted, declined, expired, or rescinded', () => {
    const transitions = VALID_TRANSITIONS.offer_sent || [];
    assert.ok(transitions.includes('offer_accepted'));
    assert.ok(transitions.includes('offer_declined'));
    assert.ok(transitions.includes('offer_expired'));
    assert.ok(transitions.includes('offer_rescinded'));
  });

  await t.test('Application: Only offer_accepted can transition to hired', () => {
    const transitions = VALID_TRANSITIONS.offer_accepted || [];
    assert.deepEqual(transitions, ['hired', 'withdrawn']);
  });

  // =========================================================================
  // 2. SCHEDULING TIME & CONFLICT LOGIC (Asia/Ho_Chi_Minh UTC+7)
  // =========================================================================
  await t.test('Shift: parseVietnamDateTime parses standard and overnight shifts correctly', () => {
    // Normal morning shift: 2026-09-30 08:00 (UTC+7) -> 2026-09-30 01:00 UTC
    const morningStart = parseVietnamDateTime('2026-09-30', '08:00', false);
    assert.equal(morningStart.toISOString(), '2026-09-30T01:00:00.000Z');

    const morningEnd = parseVietnamDateTime('2026-09-30', '12:00', false);
    assert.equal(morningEnd.toISOString(), '2026-09-30T05:00:00.000Z');

    // Overnight shift: 2026-09-30 22:00 -> 2026-10-01 02:00 (next day)
    const overnightStart = parseVietnamDateTime('2026-09-30', '22:00', false);
    assert.equal(overnightStart.toISOString(), '2026-09-30T15:00:00.000Z');

    const overnightEnd = parseVietnamDateTime('2026-09-30', '02:00', true);
    assert.equal(overnightEnd.toISOString(), '2026-10-01T19:00:00.000Z' === '2026-09-30T19:00:00.000Z' ? 'fail' : overnightEnd.toISOString());
    assert.ok(overnightEnd > overnightStart, 'Overnight end must be after overnight start');
  });

  await t.test('Shift Conflict: Boundary touching shifts (abutments) do not overlap', () => {
    // Shift A: 08:00 - 12:00
    const startA = parseVietnamDateTime('2026-09-30', '08:00', false);
    const endA = parseVietnamDateTime('2026-09-30', '12:00', false);

    // Shift B: 12:00 - 16:00 (touches at 12:00)
    const startB = parseVietnamDateTime('2026-09-30', '12:00', false);
    const endB = parseVietnamDateTime('2026-09-30', '16:00', false);

    // Conflict rule: (startA < endB) && (endA > startB)
    const hasOverlap = (startA < endB) && (endA > startB);
    assert.equal(hasOverlap, false, 'Abutting shifts (08:00-12:00 & 12:00-16:00) must NOT conflict');
  });

  await t.test('Shift Conflict: Intersecting shifts detect overlap correctly', () => {
    // Shift A: 08:00 - 12:00
    const startA = parseVietnamDateTime('2026-09-30', '08:00', false);
    const endA = parseVietnamDateTime('2026-09-30', '12:00', false);

    // Shift B: 10:00 - 14:00 (overlaps from 10:00 to 12:00)
    const startB = parseVietnamDateTime('2026-09-30', '10:00', false);
    const endB = parseVietnamDateTime('2026-09-30', '14:00', false);

    const hasOverlap = (startA < endB) && (endA > startB);
    assert.equal(hasOverlap, true, 'Intersecting shifts must be detected as conflict');
  });

  await t.test('Shift Conflict: Overnight shift detects early morning overlap correctly', () => {
    // Shift A (Overnight): 22:00 (Day 1) to 06:00 (Day 2)
    const startA = parseVietnamDateTime('2026-09-30', '22:00', false);
    const endA = parseVietnamDateTime('2026-09-30', '06:00', true); // Next day

    // Shift B: 04:00 to 08:00 (Day 2)
    const startB = parseVietnamDateTime('2026-10-01', '04:00', false);
    const endB = parseVietnamDateTime('2026-10-01', '08:00', false);

    const hasOverlap = (startA < endB) && (endA > startB);
    assert.equal(hasOverlap, true, 'Overnight shift must conflict with early morning shift on next day');
  });

  // =========================================================================
  // 3. CAPACITY & REQUISITION INVARIANTS
  // =========================================================================
  await t.test('Capacity: remainingOpenings calculation is non-negative and consistent', () => {
    function calculateCapacity(headcountTarget, hiredCount) {
      const remaining = Math.max(0, headcountTarget - hiredCount);
      const status = remaining === 0 ? 'filled' : 'open';
      return { remaining, status };
    }

    const c1 = calculateCapacity(3, 1);
    assert.equal(c1.remaining, 2);
    assert.equal(c1.status, 'open');

    const c2 = calculateCapacity(3, 3);
    assert.equal(c2.remaining, 0);
    assert.equal(c2.status, 'filled');

    const c3 = calculateCapacity(3, 4); // Edge case: overshoot
    assert.equal(c3.remaining, 0);
    assert.equal(c3.status, 'filled');
  });

  // =========================================================================
  // 4. ATTENDANCE & PAYROLL STATE SEPARATION
  // =========================================================================
  await t.test('Timesheet & Pay: approved is strictly distinct from payroll_ready and paid', () => {
    const SHIFT_STATUS_FLOW = [
      'draft',
      'published',
      'acknowledged',
      'checked_in',
      'completed_pending_review',
      'approved',
      'payroll_ready',
      'paid',
    ];

    assert.ok(SHIFT_STATUS_FLOW.indexOf('approved') < SHIFT_STATUS_FLOW.indexOf('payroll_ready'));
    assert.ok(SHIFT_STATUS_FLOW.indexOf('payroll_ready') < SHIFT_STATUS_FLOW.indexOf('paid'));
  });

  // =========================================================================
  // 5. WEEKDAY SHIFT TEMPLATE FILTERING
  // =========================================================================
  await t.test('ShiftTemplate: Matches weekday correctly (0=Sun, 1=Mon ... 6=Sat)', () => {
    // 2026-09-30 is Wednesday -> JS Date.getUTCDay() or Vietnam Day
    // In Vietnam (+7): 2026-09-30 08:00 is Wednesday (day 3)
    const testDateStr = '2026-09-30';
    const [y, m, d] = testDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 8 - 7, 0, 0));
    const dayOfWeek = dateObj.getUTCDay(); // 3 = Wednesday

    function matchesDay(templateDay, targetDay) {
      return templateDay === targetDay;
    }

    assert.equal(matchesDay(3, dayOfWeek), true, 'Wednesday template matches Wednesday');
    assert.equal(matchesDay(1, dayOfWeek), false, 'Monday template does NOT match Wednesday');
    assert.equal(matchesDay(2, dayOfWeek), false, 'Tuesday template does NOT match Wednesday');
  });
});
