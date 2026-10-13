export const FREE_ACTIVE_LISTINGS = 1;
export const SLOT_COOLDOWN_DAYS = 7; // an expired/closed free job keeps its slot this long, so reposting is not free
export const LISTING_DAYS = 14;
export const WELCOME_CREDITS = 30;
export const MAX_PINNED_FEATURED = 3;
export const EXPIRY_REMINDER_DAYS = 2;

// Employers type how many credits they want; the price is credits x vndPerCredit, with bonus credits on bigger top-ups.
export const TOPUP = {
  vndPerCredit: 1000,
  min: 20,
  max: 1000,
  step: 10,
  quick: [50, 100, 200, 500],
  bonusTiers: [{ minCredits: 200, pct: 10 }, { minCredits: 100, pct: 7 }, { minCredits: 50, pct: 5 }], // highest first; the bonus never exceeds 10%
};

/** Validates a requested amount and returns what is charged and granted; null when invalid. */
export function quoteTopUp(credits) {
  const n = Number(credits);
  if (!Number.isInteger(n) || n < TOPUP.min || n > TOPUP.max || n % TOPUP.step !== 0) return null;
  const tier = TOPUP.bonusTiers.find((t) => n >= t.minCredits);
  const bonus = tier ? Math.floor((n * tier.pct) / 100) : 0;
  return { credits: n, bonus, total: n + bonus, vnd: n * TOPUP.vndPerCredit };
}

export const CREDIT_PRICES = { featured_3d: 30, featured_7d: 60, renew_14d: 20, extra_slot: 30, quick_shift: 15 };
export const FEATURED_DAYS = { featured_3d: 3, featured_7d: 7 };
