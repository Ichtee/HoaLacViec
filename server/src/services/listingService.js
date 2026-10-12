import { Job } from '../models/Job.js';
import { LISTING_DAYS } from '../config/credits.js';

export const ACTIVE_LISTING_STATUSES = ['pending', 'approved', 'paused'];

const DAY_MS = 86400000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

// Jobs that hold a free slot: not paid-for, not archived, not past closesAt.
export function activeListingFilter(employerUserId, now = new Date()) {
  return {
    employerUserId,
    status: { $in: ACTIVE_LISTING_STATUSES },
    archivedAt: null,
    paidSlot: { $ne: true },
    $or: [{ closesAt: null }, { closesAt: { $gt: now } }], // null also matches a missing field
  };
}

export function countFreeActiveListings(employerUserId, now) {
  return Job.countDocuments(activeListingFilter(employerUserId, now));
}

export function isJobFeatured(job, now = new Date()) {
  return (!!job.featuredUntil && new Date(job.featuredUntil) > now) || job.featured === true;
}

export function applyApprovalWindow(job, now = new Date()) {
  if (!job.closesAt) job.closesAt = addDays(now, LISTING_DAYS);
  if (job.featuredDaysPending > 0) {
    const cur = job.featuredUntil ? new Date(job.featuredUntil) : null;
    job.featuredUntil = addDays(cur && cur > now ? cur : now, job.featuredDaysPending);
    job.featuredDaysPending = 0;
  }
}
