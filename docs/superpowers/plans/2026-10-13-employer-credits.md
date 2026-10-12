# Employer Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employers buy credits through the SePay payment gateway (bank-transfer QR) and spend them on featured jobs, job renewals, extra active-listing slots and quick shifts, on top of a free tier of 2 active listings × 14 days.

**Architecture:** Top-ups are SePay one-time payments: the server builds signed checkout fields with the official `sepay-pg-node` SDK, the browser POSTs them to SePay, and credits are granted when SePay's IPN says the order is paid, after the server re-checks the order with SePay's API. The balance lives on `EmployerProfile.creditBalance` and changes only through `creditService`, which updates it with a conditional `$inc` inside a Mongo transaction and writes one `CreditTransaction` row per change (append-only ledger). Job visibility uses dates, not flags: `closesAt` (listing window) and `featuredUntil` (paid boost). Both job-approval endpoints call one helper that applies those windows. The client gets one employer credits page, one admin top-up page, a quota banner + upsell in the posting flow, and "Nổi bật" pinning in the job list.

**Tech Stack:** Express 4 + Mongoose 8 (ESM), `sepay-pg-node` (SePay Node SDK, Node >= 16), `node:test` + `mongodb-memory-server` (replica set, already in devDependencies), React + Vite + Tailwind.

**Spec:** Agreed in chat on 2026-10-13 (no separate doc). The decisions:
- Model: prepaid credits, not monthly plans. Later, a monthly plan = a monthly credit grant on the same ledger.
- Free tier: at most **2 active listings** per employer; each listing is visible **14 days** after approval.
- Packs: **50.000đ → 50 credit**, **100.000đ → 110 credit**, **200.000đ → 240 credit**.
- Prices: featured **3 days = 30**, featured **7 days = 60**, renew **+14 days = 20**, extra active-listing slot **= 30** (per job), quick shift **= 15** per posting.
- Welcome grant: **30 credit** when an employer's business verification is approved (once per employer).
- Payment: SePay payment gateway, payment method `BANK_TRANSFER` only (VietQR; NAPAS QR and cards need separate SePay approval and are out of scope). Flow: employer picks a pack → server creates a pending `TopUpRequest` and returns checkout fields → browser POSTs the hidden form to SePay → customer pays → SePay calls our IPN → server verifies and grants credits → customer returns to `/employer/credits?topup=<id>`.
- SePay docs used: https://developer.sepay.vn/vi/cong-thanh-toan/{gioi-thieu,luong-thanh-toan,bat-dau,IPN,sandbox,sdk/nodejs}
- Credits are for Hoa Lạc Việc services only: not withdrawable, not transferable. Never call it "ví".
- Featured jobs: at most **3** pinned to the top of the job list, labelled "Nổi bật"; the rest keep the current ordering.
- Posting flow: show quota → form → (if quota full) pay 30 for an extra slot → submit → offer "Làm nổi bật" → admin review → visible with an expiry date → reminder 2 days before expiry → renew.

## Global Constraints

- The only new npm dependency is `sepay-pg-node` on the server (SePay's official SDK; it produces the checkout signature, whose formula SePay does not document). No new client dependencies.
- Tests run only against `mongodb-memory-server` via `test/e2e/testServer.mjs`. Never against the Atlas URI in `server/.env`. Do not run any script in this plan against Atlas; the backfill script defaults to dry-run.
- All user-facing copy is Vietnamese. Error responses use the existing shape `{ error: '<Vietnamese message>', code: 'UPPER_SNAKE' }`.
- Admin users are exempt from quotas and credit charges when posting jobs.
- Prices, packs and limits live only in `server/src/config/credits.js`; the client reads them from `GET /api/credits/pricing` and never hard-codes them.
- New env vars: `SEPAY_ENV` (`sandbox` | `production`), `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `PUBLIC_APP_URL` (origin used for the success/error/cancel return URLs). If any is missing, top-up creation returns `503 { code: 'TOPUP_UNAVAILABLE' }`. Secrets are read from env only and never logged or returned to the client.
- SePay endpoints: sandbox checkout `https://pay-sandbox.sepay.vn/v1/checkout/init`, sandbox API `https://pgapi-sandbox.sepay.vn`; production checkout `https://pay.sepay.vn/v1/checkout/init`, production API `https://pgapi.sepay.vn`. The SDK picks them from `SEPAY_ENV`; do not hard-code them.
- The IPN URL must be public HTTPS (SePay rejects localhost). For local development expose the API with ngrok/cloudflared.
- Facts SePay's docs do not give, to be confirmed in the sandbox and then pinned in `server/src/config/sepay.js` (Task 3): the exact order status that means "paid" in `client.order.retrieve` (the IPN example shows `CAPTURED`; the SDK's list-filter example shows `COMPLETED`), whether SePay retries a failed IPN, and per-transaction fees (check my.sepay.vn before setting pack prices).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **Double click / two tabs spending at once:** with balance 30, two concurrent "featured 3 days" purchases → exactly one succeeds, the other gets `402 INSUFFICIENT_CREDITS`, balance ends at 0 and never below. (Task 2 test.)
2. **IPN delivered twice or concurrently, forged, or with a different amount:** the same `ORDER_PAID` twice → credits added once; wrong or missing `X-Secret-Key` → 401 and no credits; SePay's order lookup disagreeing with our pack amount → no credits and the top-up marked `failed`. (Task 3 tests.)
3. **Employer verification approved, rejected, approved again** → welcome credit granted once. (Task 4 test.)
4. **Paid job rejected by admin** (extra slot paid, or featured bought while pending) → the employer gets those credits back as `refund` rows. (Task 5 test.)
5. **Approved job edited (core change → back to pending) and re-approved** → `closesAt` is not pushed out again; re-approval is not a free renewal. (Task 5 test.)

---

### Task 1: Config, models and listing-window helpers

**Files:**
- Create: `server/src/config/credits.js`
- Create: `server/src/models/CreditTransaction.js`
- Create: `server/src/models/TopUpRequest.js`
- Create: `server/src/config/sepay.js` (exports `SEPAY_PAID_ORDER_STATUSES = ['CAPTURED', 'COMPLETED']` as the initial, to-be-confirmed set, and `SEPAY_NOTIFICATION = { ORDER_PAID: 'ORDER_PAID', TRANSACTION_VOID: 'TRANSACTION_VOID' }`)
- Modify: `server/src/models/EmployerProfile.js` (add `creditBalance`)
- Modify: `server/src/models/Job.js:108-113` (add fields next to `featured` / `closesAt`)
- Create: `server/src/services/listingService.js`
- Test: `server/test/listingService.test.js`

**Interfaces:**
- Produces:
  - `config/credits.js` exports `FREE_ACTIVE_LISTINGS = 2`, `LISTING_DAYS = 14`, `WELCOME_CREDITS = 30`, `MAX_PINNED_FEATURED = 3`, `EXPIRY_REMINDER_DAYS = 2`, `CREDIT_PACKS = [{ id: 'p50', vnd: 50000, credits: 50 }, { id: 'p100', vnd: 100000, credits: 110 }, { id: 'p200', vnd: 200000, credits: 240 }]`, `CREDIT_PRICES = { featured_3d: 30, featured_7d: 60, renew_14d: 20, extra_slot: 30, quick_shift: 15 }`, `FEATURED_DAYS = { featured_3d: 3, featured_7d: 7 }`.
  - `CreditTransaction` fields: `employerUserId` (ObjectId, ref User, required, indexed), `amount` (Number, required, non-zero; + grant, − spend), `type` enum `['topup','welcome','spend','refund','adjust']`, `reason` (String, one of the `CREDIT_PRICES` keys, `'welcome'`, a pack id, or `'admin_adjust'`), `refType` enum `['Job','QuickShift','TopUpRequest',null]`, `refId` (ObjectId|null), `balanceAfter` (Number), `createdBy` (ObjectId|null), `note` (String). Timestamps. Partial unique index `{ employerUserId: 1, type: 1 }` where `type: 'welcome'`.
  - `TopUpRequest` fields: `employerUserId` (required, indexed), `packId`, `amountVnd`, `credits`, `invoiceNumber` (String, unique; format `HLV` + 8 uppercase alphanumerics; sent to SePay as `order_invoice_number`), `status` enum `['pending','paid','failed','cancelled','voided']` default `'pending'`, `sepayOrderId` (String|null), `paidAt` (Date|null), `failureReason` (String). Timestamps.
  - `EmployerProfile.creditBalance`: `{ type: Number, default: 0, min: 0 }`.
  - `Job` new fields: `featuredUntil: Date|null`, `featuredDaysPending: { type: Number, default: 0, min: 0 }`, `paidSlot: { type: Boolean, default: false }`, `expiryReminderSentAt: Date|null`.
  - `listingService.js`:
    - `ACTIVE_LISTING_STATUSES = ['pending','approved','paused']`
    - `activeListingFilter(employerUserId, now = new Date()) -> object`: Mongo filter for jobs that hold a slot: owner match, `status` in `ACTIVE_LISTING_STATUSES`, `archivedAt: null`, `paidSlot: { $ne: true }`, and (`closesAt` missing/null or `> now`).
    - `countFreeActiveListings(employerUserId, now?) -> Promise<number>`
    - `isJobFeatured(job, now = new Date()) -> boolean`: `featuredUntil > now`, or legacy `featured === true`.
    - `applyApprovalWindow(job, now = new Date()) -> void`: mutates the doc. If `closesAt` is not set, set `closesAt = now + LISTING_DAYS`. If `featuredDaysPending > 0`, set `featuredUntil = max(now, featuredUntil) + featuredDaysPending days` and reset `featuredDaysPending = 0`. Never moves an existing `closesAt`.

- [ ] **Step 1: Write the failing tests** in `server/test/listingService.test.js` (pure functions on plain objects, no DB)

```js
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
test('activeListingFilter ignores drafts, closed, paid-slot and expired jobs', () => {
  const f = activeListingFilter('507f1f77bcf86cd799439011', new Date('2026-10-13T00:00:00Z'));
  assert.deepEqual(f.status, { $in: ['pending', 'approved', 'paused'] });
  assert.deepEqual(f.paidSlot, { $ne: true });
});
```

- [ ] **Step 2: Run** `cd server && node --test test/listingService.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement** `config/credits.js`, the two models, the field additions and `listingService.js` with the signatures above. Add days with `new Date(base.getTime() + days * 86400000)`.
- [ ] **Step 4: Run** `node --test test/listingService.test.js` → PASS, then `npm test` → no regressions.
- [ ] **Step 5: Commit** `feat(credits): config, ledger/top-up models, listing window helpers`

---

### Task 2: creditService (grant, spend, refund)

**Files:**
- Create: `server/src/services/creditService.js`
- Create: `server/src/utils/httpError.js` (moved from `server/src/routes/quickShiftRoutes.js:17`)
- Modify: `server/src/routes/quickShiftRoutes.js` (import `httpError` instead of defining it)
- Test: `server/test/integration/credits.test.js` (memory server via `startTestServer`; add `CreditTransaction` and `TopUpRequest` to its `models` map in `server/test/e2e/testServer.mjs`)

**Interfaces:**
- Consumes: Task 1 models and config.
- Produces:
  - `grantCredits({ employerUserId, amount, type, reason, refType = null, refId = null, createdBy = null, note = '', session = null }) -> Promise<{ balance: number, transaction }>`: `amount > 0`. `$inc` on `EmployerProfile` (`{ userId: employerUserId }`), then writes the ledger row with `balanceAfter`.
  - `spendCredits({ employerUserId, reason, refType, refId, createdBy, session = null }) -> Promise<{ balance, transaction }>`: cost = `CREDIT_PRICES[reason]`. Throws `httpError(402, 'INSUFFICIENT_CREDITS', 'Không đủ credit. Vui lòng nạp thêm.')` when the balance is too low.
  - `refundCredits({ employerUserId, reason, refType, refId, createdBy, session }) -> Promise<{ balance, transaction }>`: grant of `CREDIT_PRICES[reason]` with `type: 'refund'`.
  - `withCreditTransaction(fn) -> Promise<T>`: runs `fn(session)` in `mongoose.connection.transaction()`. Every route that charges credits and changes a document does both inside this.
  - `getBalance(employerUserId) -> Promise<number>`
  - `httpError` is currently a private function at `server/src/routes/quickShiftRoutes.js:17`. Move it unchanged to `server/src/utils/httpError.js` (`export function httpError(status, code, message)`), and import it from there in `quickShiftRoutes.js` and `creditService.js`.

The spend must be one conditional update, so two concurrent spends can't both pass the check:

```js
const profile = await EmployerProfile.findOneAndUpdate(
  { userId: employerUserId, creditBalance: { $gte: cost } },
  { $inc: { creditBalance: -cost } },
  { new: true, session }
);
if (!profile) throw httpError(402, 'INSUFFICIENT_CREDITS', 'Không đủ credit. Vui lòng nạp thêm.');
```

- [ ] **Step 1: Write the failing tests** in `test/integration/credits.test.js`:
  - `grantCredits` 50 then `spendCredits('featured_3d')` → balance 20; ledger has rows `+50 topup` and `-30 spend` with `balanceAfter` 50 and 20.
  - Spending with balance 10 → rejects with status 402 and code `INSUFFICIENT_CREDITS`; balance stays 10; no spend row written.
  - **Review Focus 1:** balance 30, `Promise.allSettled` of two `spendCredits('featured_3d')` → one fulfilled, one rejected with 402; final balance 0.
  - Granting `type: 'welcome'` twice for the same employer → the second rejects (duplicate key); balance increases once.
- [ ] **Step 2: Run** `cd server && node --test --test-concurrency=1 test/integration/credits.test.js` → FAIL.
- [ ] **Step 3: Implement** `creditService.js` per the interfaces.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(credits): atomic credit ledger service`

---

### Task 3: SePay checkout, IPN and credit API

**Files:**
- Create: `server/src/services/sepayClient.js`
- Create: `server/src/services/topUpService.js`
- Create: `server/src/routes/creditRoutes.js`
- Modify: `server/package.json` (add `sepay-pg-node`), `server/src/app.js:147` (mount `app.use('/api/credits', creditRoutes)` next to `quick-shifts`)
- Test: `server/test/integration/credits.test.js` (extend)

**Interfaces:**
- Consumes: Task 2 service, `authenticate`, `authorize`, `requireActiveUser` (same imports as `quickShiftRoutes.js`).
- Produces:
  - `sepayClient.js`: `getSepayClient() -> { initCheckoutUrl(): string, initOneTimePaymentFields(p): object, retrieveOrder(invoice): Promise<{ order_status: string, order_amount: string|number, order_invoice_number: string }> }`. Production code wraps `SePayPgClient` from `sepay-pg-node` (`client.checkout.initCheckoutUrl()`, `client.checkout.initOneTimePaymentFields()`, `client.order.retrieve()`, unwrapping `.data`). Throws `httpError(503, 'TOPUP_UNAVAILABLE', ...)` if the env vars are missing. `setSepayClientForTests(fake|null)` swaps in a fake.
  - `topUpService.js`: `applySepayOrderPaid(invoiceNumber, { source }) -> Promise<{ status: 'granted'|'already_paid'|'unknown'|'not_paid'|'amount_mismatch', topUp }>`. It loads the `TopUpRequest` and asks `retrieveOrder`. If the order status is not in `SEPAY_PAID_ORDER_STATUSES` → `not_paid`. If `Number(order_amount) !== topUp.amountVnd` → set `failed` with `failureReason: 'amount_mismatch'` and return `amount_mismatch`. Otherwise, in `withCreditTransaction`: conditional `findOneAndUpdate({ _id, status: 'pending' }, { status: 'paid', paidAt, sepayOrderId })`, then `grantCredits({ type: 'topup', reason: topUp.packId, refType: 'TopUpRequest', refId: topUp._id })`; if the conditional update matched nothing → `already_paid`. It never trusts the IPN body for amount or status.
  - `GET /api/credits/pricing` (public) → `{ packs: CREDIT_PACKS, prices: CREDIT_PRICES, freeActiveListings, listingDays, welcomeCredits }`
  - `GET /api/credits/me` (employer) → `{ balance, freeActiveListings, activeListings, transactions }` (`transactions` = latest 50, newest first)
  - `POST /api/credits/topups` (employer, active) body `{ packId }` → `201 { topUp, checkout: { url, fields } }`. `fields` come from `initOneTimePaymentFields({ operation: 'PURCHASE', payment_method: 'BANK_TRANSFER', order_invoice_number: topUp.invoiceNumber, order_amount: topUp.amountVnd, currency: 'VND', order_description: 'Nap <credits> credit Hoa Lac Viec', customer_id: String(employerUserId), success_url: PUBLIC_APP_URL + '/employer/credits?topup=' + topUp._id, error_url: same + '&result=error', cancel_url: same + '&result=cancel' })`. Unknown pack → `400 INVALID_PACK`; more than 3 pending requests → `429 TOO_MANY_PENDING_TOPUPS`; env missing → 503.
  - `GET /api/credits/topups/mine` (employer) → `{ topUps }` (newest 20); `GET /api/credits/topups/:id` (owner) → `{ topUp, balance }` (404 if not the owner's).
  - `POST /api/credits/topups/:id/reconcile` (owner, limited to 10/min per user) → runs `applySepayOrderPaid`; returns `{ result, topUp, balance }`. Used when the IPN is late or missed.
  - `POST /api/credits/sepay/ipn` (public, no JWT): 401 `{ code: 'INVALID_IPN_SECRET' }` unless the `X-Secret-Key` header equals `SEPAY_SECRET_KEY` (compare with `crypto.timingSafeEqual` on equal-length buffers). Then by `body.notification_type`:
    - `ORDER_PAID` → `applySepayOrderPaid(body.order.order_invoice_number, { source: 'ipn' })`. For `granted`, `already_paid`, `unknown`, `not_paid` and `amount_mismatch` respond `200 { success: true }` (a 4xx would only make SePay retry something already decided). If `retrieveOrder` itself throws, respond `502` so a retry can happen. On `granted`, create the employer `Notification` (`type: 'credit'`, link `/employer/credits`).
    - `TRANSACTION_VOID` → set the matching top-up to `voided` and `console.warn` it (credits are not clawed back automatically; an admin handles it via Task 9). Respond 200.
    - anything else → 200.
  - `GET /api/credits/admin/topups?status=` (admin) and `POST /api/credits/admin/topups/:id/reconcile` (admin): the same lookup and `applySepayOrderPaid` as the owner route without the ownership check; the list includes `employer: { name, email, storeName }`.

- [ ] **Step 1: Write the failing tests** (memory server; inject a fake client with `setSepayClientForTests`; set the `SEPAY_*` env vars and `PUBLIC_APP_URL` in the test):
  - `GET /pricing` returns the three packs and `prices.extra_slot === 30`.
  - Employer `POST /topups { packId: 'p100' }` → 201; `topUp.invoiceNumber` matches `/^HLV[A-Z0-9]{8}$/`; the fake recorded `order_amount: 100000`, `payment_method: 'BANK_TRANSFER'` and a `success_url` ending in the top-up id; the response includes `checkout.fields.signature` from the fake. Without env vars → 503 `TOPUP_UNAVAILABLE`. A fourth pending request → 429.
  - IPN `ORDER_PAID` with the right secret and a fake `retrieveOrder` returning a paid status and `order_amount: '100000.00'` → 200; `GET /me` shows balance 110 and one `topup` row; the top-up is `paid`.
  - **Review Focus 2:** the same IPN sent twice, sequentially and with `Promise.all` → balance 110 once. Missing or wrong `X-Secret-Key` → 401, balance 0, top-up still `pending`. IPN claims paid but `retrieveOrder` returns amount `50000` → 200, balance 0, top-up `failed`. `retrieveOrder` returning an unpaid status → balance 0, still `pending`. `retrieveOrder` throwing → 502, still `pending`. IPN for an unknown invoice → 200, nothing changes.
  - `reconcile` by the owner after a missed IPN → grants once; by another employer → 404; by a student → 403.
  - `TRANSACTION_VOID` → top-up `voided`, balance unchanged.
  - A student calling `POST /topups` → 403; an employer calling `/admin/topups` → 403.
- [ ] **Step 2: Run** `cd server && npm i sepay-pg-node && node --test --test-concurrency=1 test/integration/credits.test.js` → the new tests FAIL.
- [ ] **Step 3: Implement** the files above. Generate `invoiceNumber` with `crypto.randomBytes` mapped to `[A-Z0-9]` and retry once on a duplicate key. Mount the IPN route so it is not behind JWT. Log every IPN outcome with the invoice number, never the secret.
- [ ] **Step 4: Run** the same command → PASS; then `npm test` → no regressions.
- [ ] **Step 5: Manual sandbox check (needs the user's SePay sandbox credentials; use the in-memory API, never Atlas):** put the sandbox `SEPAY_*` values in the environment, run the standalone test server, expose it with ngrok/cloudflared, set that HTTPS URL + `/api/credits/sepay/ipn` as the IPN URL in my.sepay.vn (Cổng thanh toán → Cấu hình → IPN, auth type SECRET_KEY), create a top-up and complete the sandbox checkout. Put the real IPN body and the real `retrieveOrder` result in the commit message; if the paid status differs from `SEPAY_PAID_ORDER_STATUSES`, correct that constant to the observed value.
- [ ] **Step 6: Commit** `feat(credits): SePay checkout, verified IPN and credit API`

---

### Task 4: Welcome credit on employer verification

**Files:**
- Modify: `server/src/routes/adminRoutes.js:470-485` (employer branch of `POST /verifications/:id/approve`, after the `EmployerProfile.findOneAndUpdate`)
- Test: `server/test/integration/credits.test.js` (extend)

**Interfaces:**
- Consumes: `grantCredits` (Task 2), `WELCOME_CREDITS` (Task 1).

- [ ] **Step 1: Write the failing test:** create a pending employer + `EmployerVerification`, admin approves → `GET /api/credits/me` balance 30 with one `welcome` row. **Review Focus 3:** reject, re-submit and approve again → balance still 30, still one `welcome` row.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** call `grantCredits({ employerUserId: verification.employerUserId, amount: WELCOME_CREDITS, type: 'welcome', reason: 'welcome', createdBy: req.user._id })`. Catch Mongo duplicate-key error `11000` and ignore it (already granted). Any other error → `console.warn`, never fail the approval.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(credits): 30 welcome credits once when an employer is verified`

---

### Task 5: Quota, extra slot, approval window and refunds on jobs

**Files:**
- Modify: `server/src/routes/jobRoutes.js:489-561` (`POST /`), `:670-710` (`POST /:id/approve`), `:712-750` (`POST /:id/reject`), `:197-410` (`GET /`: response `featured`, featured filter/sort)
- Modify: `server/src/routes/adminRoutes.js:166-248` (`POST /jobs/:id/approve`, `POST /jobs/:id/reject`)
- Test: `server/test/integration/credits.test.js` (extend)

**Interfaces:**
- Consumes: `countFreeActiveListings`, `applyApprovalWindow`, `isJobFeatured` (Task 1); `spendCredits`, `refundCredits`, `withCreditTransaction` (Task 2).
- Produces:
  - `POST /api/jobs` accepts `useExtraSlot: boolean`. For employers, when the status would be `pending`:
    - if `countFreeActiveListings` ≥ `FREE_ACTIVE_LISTINGS` and not `useExtraSlot` → `402 { code: 'LISTING_QUOTA_REACHED', freeActiveListings, activeListings }`.
    - if `useExtraSlot` → in one `withCreditTransaction`: `spendCredits({ reason: 'extra_slot', refType: 'Job' })`, create the job with `paidSlot: true`, then set the ledger row's `refId` to the job id.
    - Drafts are never charged and never blocked.
  - Both approve endpoints call `applyApprovalWindow(job)` before `job.save()`.
  - Both reject endpoints, inside `withCreditTransaction`: if `job.paidSlot` → `refundCredits('extra_slot')` and set `paidSlot = false`. If `job.featuredDaysPending` is 3 or 7 → `refundCredits('featured_3d' | 'featured_7d')` and set it to 0. Put this in one helper, `refundJobPurchases(job, adminUserId, session)`, in `creditService.js`, so the two routes don't duplicate it.
  - `GET /api/jobs`: each returned job gets `featured: isJobFeatured(job)`. `featured=true` filter → `$or: [{ featuredUntil: { $gt: now } }, { featured: true }]`. `sort=featured` → `{ featuredUntil: -1, createdAt: -1 }`.

- [ ] **Step 1: Write the failing tests:**
  - Verified employer with 2 approved unexpired jobs posts a third → 402 `LISTING_QUOTA_REACHED`. Same with `useExtraSlot: true` and balance 30 → 201, `paidSlot: true`, balance 0. With `useExtraSlot: true` and balance 0 → 402 `INSUFFICIENT_CREDITS` and no job created.
  - A job with `closesAt` in the past doesn't count. A draft doesn't count. A paused job does count.
  - Admin approves a pending job → `closesAt` is about 14 days ahead (allow ±1 minute).
  - **Review Focus 5:** approved job edited with a core change (back to `pending`), approved again → `closesAt` unchanged.
  - **Review Focus 4:** paid-slot job rejected → balance back to 30 and a `refund` row with `refId` = job id. Repeat the same through `/api/admin/jobs/:id/reject`.
  - `GET /api/jobs` marks a job with `featuredUntil` tomorrow as `featured: true`, and one that ended yesterday as `featured: false`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** as specified. Keep the existing `LOCATION_REQUIRED` and `EMPLOYER_NOT_VERIFIED` checks ahead of the quota check, so a rejected request never charges.
- [ ] **Step 4: Run** the integration file, then `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(credits): free listing quota, paid extra slot, 14-day window, refunds on reject`

---

### Task 6: Featured and renew purchases; quick-shift charge

**Files:**
- Modify: `server/src/routes/creditRoutes.js` (two endpoints)
- Modify: `server/src/routes/quickShiftRoutes.js:88` (`POST /`)
- Test: `server/test/integration/credits.test.js` (extend); update `server/test/quickShifts.test.js` stubs so the existing test still passes (stub `spendCredits`, or give the stubbed profile a balance)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `POST /api/credits/jobs/:id/feature` (employer owner) body `{ days: 3 | 7 }` → `{ job, balance }`. Reason is `featured_${days}d`; other values → `400 INVALID_DAYS`. Job `approved` → `featuredUntil = max(now, featuredUntil) + days`. Job `pending` → `featuredDaysPending = days`, or `409 FEATURE_ALREADY_PENDING` if already set. Any other status → `409 INVALID_STATE`. Not the owner → 403.
  - `POST /api/credits/jobs/:id/renew` (employer owner) → `{ job, balance }`. Allowed for `approved` or `paused`, including jobs whose `closesAt` has passed. `closesAt = max(now, closesAt) + LISTING_DAYS`; reset `expiryReminderSentAt = null`. Charge `renew_14d`.
  - `POST /api/quick-shifts`: after validation and before `QuickShift.create`, in `withCreditTransaction`: `spendCredits({ reason: 'quick_shift', refType: 'QuickShift' })`, create, set the ledger `refId`. No refund on cancel; the UI says so.

- [ ] **Step 1: Write the failing tests:** feature 7 days on an approved job with balance 60 → `featuredUntil` about now+7d, balance 0. Feature again for 3 days with balance 30 → extends from the previous `featuredUntil`, not from now. Feature on a pending job → `featuredDaysPending: 3`, then approve → `featuredUntil` about approval+3d. Renew an expired job (`closesAt` yesterday) → `closesAt` about now+14d and it shows in `GET /api/jobs` again. Quick shift with balance 0 → 402 and no `QuickShift` doc; with balance 15 → 201, balance 0.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the integration file + `npm test` (including the updated `quickShifts.test.js`) → PASS.
- [ ] **Step 5: Commit** `feat(credits): buy featured days, renew listings, charge quick shifts`

---

### Task 7: Expiry reminders and backfill script

**Files:**
- Modify: `server/src/services/maintenanceService.js` (add `notifyExpiringJobs(now)` and register it with the existing periodic runner)
- Create: `server/src/scripts/backfillJobExpiry.js`; add `"backfill:job-expiry": "node src/scripts/backfillJobExpiry.js"` to `server/package.json`
- Test: `server/test/integration/credits.test.js` (extend)

**Interfaces:**
- Produces:
  - `notifyExpiringJobs(now = new Date()) -> Promise<number>`: approved jobs with `closesAt` between `now` and `now + EXPIRY_REMINDER_DAYS` and `expiryReminderSentAt: null`. Sends one `Notification` per job (`type: 'job'`, title `Tin tuyển dụng sắp hết hạn`, message naming the job and the date, link `/employer/jobs`), then sets `expiryReminderSentAt`. Returns the count.
  - `backfillJobExpiry({ apply = false, now = new Date(), log }) -> Promise<{ matched, updated }>`: approved/paused jobs without `closesAt` get `closesAt = now + LISTING_DAYS`. Dry-run unless the CLI gets `--apply`. Same CLI shape as `backfillJobLocations.js`.

- [ ] **Step 1: Write the failing tests:** a job closing in 1 day → `notifyExpiringJobs` returns 1; calling again returns 0. A job closing in 5 days → 0. `backfillJobExpiry({ apply: false })` reports matched > 0 and leaves the docs unchanged; `{ apply: true }` sets `closesAt`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(credits): expiry reminders and dry-run backfill for listing windows`

---

### Task 8: Client API and employer credits page

**Files:**
- Modify: `client/src/services/api.js` (functions below, using the existing `request()`); re-export from `client/src/services/index.js` the same way the neighbouring functions are
- Create: `client/src/pages/employer/EmployerCreditsPage.jsx`
- Modify: `client/src/App.jsx` (lazy route `credits` under `/employer`), `client/src/layouts/EmployerLayout.jsx:20` (nav item `{ to: '/employer/credits', label: 'Credit', icon: Coins }`)

**Interfaces:**
- Produces in `api.js`: `apiGetCreditPricing()`, `apiGetMyCredits()`, `apiCreateTopUp(packId)`, `apiGetMyTopUps()`, `apiGetTopUp(id)`, `apiReconcileTopUp(id)`, `apiFeatureJob(jobId, days)`, `apiRenewJob(jobId)`, `apiAdminListTopUps(status)`, `apiAdminReconcileTopUp(id)`. Each maps one-to-one to the Task 3/6 endpoints.
- Page layout:
  - `PageHeader` (icon `Coins`, title `Credit của cửa hàng`) with the balance as the badge.
  - Pack cards from `/pricing`. Choosing one calls `apiCreateTopUp`, then submits a hidden `<form method="POST" action={checkout.url}>` with one hidden input per `checkout.fields` entry (the SePay payment page opens; we render no QR ourselves).
  - On return (`?topup=<id>`): poll `GET /topups/:id` every 3 s for up to 30 s showing `Đang xác nhận thanh toán...`; on `paid` show `Đã cộng {credits} credit`; on `result=error|cancel` show the matching message; if still pending after 30 s show `Kiểm tra lại`, which calls `POST /topups/:id/reconcile`.
  - "Bảng giá dịch vụ" listing every price from `/pricing`.
  - Ledger table (time, nội dung, ±credit, số dư).
  - Note under the packs, verbatim: `Credit chỉ dùng cho dịch vụ trên Hoa Lạc Việc, không quy đổi thành tiền và không chuyển nhượng.`

- [ ] **Step 1:** Implement the api functions, page, route and nav item.
- [ ] **Step 2: Verify:** `cd client && npx vite build` → built; `npm run lint` → no `jsx-no-undef` errors.
- [ ] **Step 3: Verify in the browser** against the in-memory API, never Atlas: run `cd server && node test/e2e/testServer.mjs` (port 5055, seeds sample data), then `cd client && VITE_PROXY_TARGET=http://localhost:5055 npm run dev`. Then: log in as an employer, open `/employer/credits`, create a `p50` top-up → the browser is sent to the SePay sandbox payment page (with the sandbox credentials from Task 3 step 5; without them, only confirm the hidden form's `action` and fields); after paying, `/employer/credits?topup=<id>` shows `Đã cộng 50 credit`; mobile width 390 has no horizontal overflow.
- [ ] **Step 4: Commit** `feat(credits): employer credits page with SePay checkout`

---

### Task 9: Admin top-up monitor page

**Files:**
- Create: `client/src/pages/admin/AdminTopUpsPage.jsx`
- Modify: `client/src/App.jsx` (route `topups` under `/admin`), the admin layout nav (same file pattern as `EmployerLayout.jsx`; add `{ to: '/admin/topups', label: 'Nạp credit', icon: Coins }`)

**Interfaces:**
- Consumes: `apiAdminListTopUps`, `apiAdminReconcileTopUp` (Task 8).
- Page layout: `PageHeader` with a badge counting `pending` + `voided`; tabs `Tất cả / Chờ thanh toán / Đã thanh toán / Lỗi / Đã hủy`. Each row: store, email, pack, amount (VND), invoice number, status badge, created and paid times. Rows that are `pending` or `failed` have `Kiểm tra lại với SePay` (calls reconcile, shows the result message, disables the button while it runs). `voided` rows show the warning `Giao dịch bị hủy bên SePay - cần xử lý thủ công`. This page never grants credits by itself; only `applySepayOrderPaid` does, after SePay confirms.

- [ ] **Step 1:** Implement the page, route and nav.
- [ ] **Step 2: Verify:** build + lint as in Task 8; in the browser with the in-memory API: a `pending` top-up whose order SePay reports as paid turns `Đã thanh toán` after `Kiểm tra lại với SePay`, and the employer's balance rises.
- [ ] **Step 3: Commit** `feat(credits): admin top-up monitor and reconcile`

---

### Task 10: Posting flow (quota, extra slot, upsell) and job management actions

**Files:**
- Create: `client/src/components/FeatureJobModal.jsx`
- Modify: `client/src/pages/employer/EmployerJobFormPage.jsx` (quota banner, extra-slot checkbox, redirect with upsell)
- Modify: `client/src/pages/employer/EmployerJobsPage.jsx` (expiry/featured info + actions; open the modal from `?upsell=<jobId>`)
- Modify: `client/src/pages/employer/EmployerQuickShiftsPage.jsx` (show `15 credit` on the post button; handle 402)

**Interfaces:**
- Consumes: `apiGetMyCredits`, `apiGetCreditPricing`, `apiFeatureJob`, `apiRenewJob` (Task 8); `POST /api/jobs` `useExtraSlot` and error codes (Task 5).
- Produces: `FeatureJobModal({ job, prices, balance, onClose, onDone })`: two options (3 ngày / 7 ngày) with their credit prices; buy button disabled when the balance is too low, with a link `Nạp thêm credit` → `/employer/credits`; shows API errors inline.

**Behaviour:**
- **Job form, new jobs only:**
  - Banner: `Tin miễn phí đang hiển thị: {activeListings}/{freeActiveListings}`.
  - When full, show a required checkbox `Dùng {extra_slot} credit để đăng thêm tin này (số dư: {balance})`; submit sends `useExtraSlot: true`.
  - On 402 `LISTING_QUOTA_REACHED` / `INSUFFICIENT_CREDITS`: show the matching Vietnamese message with a link to `/employer/credits`.
  - On success: navigate to `/employer/jobs?upsell=<newId>`.
- **Jobs list:**
  - Show `Hết hạn: dd/mm` (from `closesAt`) and `Nổi bật đến dd/mm` (when `featuredUntil` is in the future).
  - Actions `Làm nổi bật` (opens the modal) and `Gia hạn 14 ngày ({renew_14d} credit)` with a confirm.
  - Expired listings show a `Đã hết hạn` badge and the renew action.
  - Opening `?upsell=<id>` shows the modal once, then removes the param.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:** build + lint. In the browser against the memory-server API:
  - an employer with 2 active jobs sees the checkbox; posting with 0 credits shows the insufficient-credit message and creates nothing;
  - with credits, the post succeeds and the upsell modal opens;
  - buying 3 days on the pending job, then admin approval, shows `Nổi bật đến` 3 days after approval.
- [ ] **Step 3: Commit** `feat(credits): quota-aware posting flow with featured upsell and renewals`

---

### Task 11: Featured pinning in the job list

**Files:**
- Modify: `client/src/pages/public/JobListPage.jsx` (where `sorted` is computed)
- Modify: `client/src/components/JobCard.jsx:149` (label already keyed on `job.featured`; change its text to `Nổi bật`, pink badge)

**Interfaces:**
- Consumes: `featured` from `GET /api/jobs` (Task 5); `MAX_PINNED_FEATURED = 3` (mirror it as a constant in the page with a comment pointing at `server/src/config/credits.js`; this is the one allowed duplicate, because `/pricing` doesn't carry it).
- Behaviour: after the existing sort, move up to 3 featured jobs (keeping their relative order) to the front; every other job keeps its position from the existing sort. The map is unchanged. Featured markers keep the current marker.

- [ ] **Step 1:** Extract a pure helper `pinFeatured(jobs, max = 3)` in `client/src/utils/jobLocation.js` (it already holds list helpers) and use it in the page.
- [ ] **Step 2: Verify:** build + lint; in the browser with 4 featured jobs and distance sort, exactly 3 appear first with the `Nổi bật` badge, and the 4th stays at its distance position.
- [ ] **Step 3: Commit** `feat(credits): pin up to 3 featured jobs in the job list`

---

## Out of scope (v1)

- Credit expiry (12 months, mentioned in chat): no expiry logic yet. The note on the credits page does not promise one.
- NAPAS QR and card payments (separate SePay approval), recurring payments (not released by SePay), automatic clawback when SePay voids a transaction, and monthly plans.
- Refund when a quick shift is cancelled.
