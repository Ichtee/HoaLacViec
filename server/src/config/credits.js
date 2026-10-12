export const FREE_ACTIVE_LISTINGS = 1;
export const SLOT_COOLDOWN_DAYS = 7; // an expired/closed free job keeps its slot this long, so reposting is not free
export const LISTING_DAYS = 14;
export const WELCOME_CREDITS = 30;
export const MAX_PINNED_FEATURED = 3;
export const EXPIRY_REMINDER_DAYS = 2;

export const CREDIT_PACKS = [
  { id: 'p50', vnd: 50000, credits: 50 },
  { id: 'p100', vnd: 100000, credits: 110 },
  { id: 'p200', vnd: 200000, credits: 240 },
];

export const CREDIT_PRICES = { featured_3d: 30, featured_7d: 60, renew_14d: 20, extra_slot: 30, quick_shift: 15 };
export const FEATURED_DAYS = { featured_3d: 3, featured_7d: 7 };
