import { Job } from '../models/Job.js';
import { LISTING_DAYS, SLOT_COOLDOWN_DAYS } from '../config/credits.js';

export const ACTIVE_LISTING_STATUSES = ['pending', 'approved', 'paused'];

const DAY_MS = 86400000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

// Jobs that hold a free slot: not paid-for, not archived, live (closesAt null or future),
// or expired/closed less than SLOT_COOLDOWN_DAYS ago. Drafts and rejected jobs never hold one.
export function activeListingFilter(employerUserId, now = new Date(), excludeJobId = null) {
  return {
    employerUserId,
    archivedAt: null,
    paidSlot: { $ne: true },
    ...(excludeJobId ? { _id: { $ne: excludeJobId } } : {}),
    $or: [
      { status: { $in: ACTIVE_LISTING_STATUSES }, closesAt: null }, // null also matches a missing field
      { status: { $in: [...ACTIVE_LISTING_STATUSES, 'expired', 'closed'] }, closesAt: { $gt: addDays(now, -SLOT_COOLDOWN_DAYS) } },
    ],
  };
}

export function countFreeActiveListings(employerUserId, now = new Date(), excludeJobId = null) {
  return Job.countDocuments(activeListingFilter(employerUserId, now, excludeJobId));
}

export function isJobFeatured(job, now = new Date()) {
  return (!!job.featuredUntil && new Date(job.featuredUntil) > now) || job.featured === true;
}

/** Featured order: active boosts first (more credits spent first, then later end date), then legacy flag, then the rest by newest. */
export function compareFeaturedFirst(a, b, now = new Date()) {
  const until = (j) => (j.featuredUntil ? new Date(j.featuredUntil).getTime() : 0);
  const rank = (j) => (!!j.featuredUntil && until(j) > now.getTime() ? 0 : isJobFeatured(j, now) ? 1 : 2);
  return rank(a) - rank(b)
    || (rank(a) === 0 ? (b.boostCredits || 0) - (a.boostCredits || 0) || until(b) - until(a) : 0)
    || new Date(b.createdAt) - new Date(a.createdAt);
}

export function applyApprovalWindow(job, now = new Date()) {
  if (!job.closesAt) job.closesAt = addDays(now, LISTING_DAYS);
  if (job.featuredDaysPending > 0) {
    const cur = job.featuredUntil ? new Date(job.featuredUntil) : null;
    job.featuredUntil = addDays(cur && cur > now ? cur : now, job.featuredDaysPending);
    job.featuredDaysPending = 0;
  }
}
