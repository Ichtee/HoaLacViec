import test from 'node:test';
import assert from 'node:assert/strict';
import { activeListingFilter, applyApprovalWindow, isJobFeatured } from '../src/services/listingService.js';

test('applyApprovalWindow sets a 14-day window once and never extends it', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  const job = { closesAt: null, featuredDaysPending: 0 };
  applyApprovalWindow(job, now);
  assert.equal(job.closesAt.toISOString(), '2026-10-27T00:00:00.000Z');
  applyApprovalWindow(job, new Date('2026-10-20T00:00:00Z')); // re-approval after an edit
  assert.equal(job.closesAt.toISOString(), '2026-10-27T00:00:00.000Z');
});
test('applyApprovalWindow turns pending featured days into featuredUntil', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  const job = { closesAt: null, featuredDaysPending: 7, featuredUntil: null };
  applyApprovalWindow(job, now);
  assert.equal(job.featuredUntil.toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(job.featuredDaysPending, 0);
});
test('isJobFeatured respects featuredUntil and the legacy flag', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  assert.equal(isJobFeatured({ featuredUntil: new Date('2026-10-14T00:00:00Z') }, now), true);
  assert.equal(isJobFeatured({ featuredUntil: new Date('2026-10-12T00:00:00Z') }, now), false);
  assert.equal(isJobFeatured({ featured: true }, now), true);
});
test('activeListingFilter: live jobs, or expired/closed within the 7-day cooldown; never paid-slot', () => {
  const f = activeListingFilter('507f1f77bcf86cd799439011', new Date('2026-10-13T00:00:00Z'));
  assert.deepEqual(f.$or[0].status, { $in: ['pending', 'approved', 'paused'] });
  assert.deepEqual(f.$or[1].status.$in, ['pending', 'approved', 'paused', 'expired', 'closed']);
  assert.equal(f.$or[1].closesAt.$gt.toISOString(), '2026-10-06T00:00:00.000Z');
  assert.deepEqual(f.paidSlot, { $ne: true });
});
