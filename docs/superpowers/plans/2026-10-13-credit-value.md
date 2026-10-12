# Credit value: make paying for listings worth it

Goal: employers have a real reason to spend credits. Decided 2026-10-13: free tier 1 listing x 14 days with a repost cooldown; scope A (stats), B (TopCV-style search page with featured visibility), C (push to students on feature). "Làm mới tin" (bump) is out of scope.

Execution: subagent-driven, Sonnet only, one review per group. UI tasks load the ui-ux-pro-max skill rules by hand (no Python). Verify client with `npx vite build` + `npm run lint`; server with `npm test` + `npm run test:integration`.

## Findings (why nobody pays today)
1. Free tier 2 active listings; most stores have 0-1 jobs, so `extra_slot` never triggers.
2. Expired jobs release their slot at once, so reposting is free while renew costs 20.
3. Featured is near invisible: ~12 visible jobs, list fetches 200 at once, map (desktop default) has no featured marker, featured pin breaks "Gần tôi nhất".
4. Employers never see views/applications, so no ROI and no repeat purchase.

## Task 1 - Free tier 1 listing + repost cooldown (server)
- `server/src/config/credits.js`: `FREE_ACTIVE_LISTINGS = 1`, add `SLOT_COOLDOWN_DAYS = 7`.
- `listingService.activeListingFilter`: a non-paid job holds the free slot while status in pending/approved/paused/expired/closed, not archived, and `closesAt` is null or later than `now - SLOT_COOLDOWN_DAYS`. Draft/rejected never hold it.
- Closing a job early (`/:id/close` and admin close) sets `closesAt = now` when it is later, so the 7-day cooldown starts at closing.
- Grandfather: no change to existing jobs; an employer already over the new limit keeps them but the next post hits 402.
- Renew of an expired job inside its cooldown no longer needs `extra_slot` (it still holds its own slot): renew checks the count excluding itself.
- Tests: second post with one active -> 402; post 3 days after expiry -> 402; post 8 days after -> 201; renew of own expired job -> only renew_14d; draft/rejected do not count.
- Client copy: every "2 tin" text comes from `/api/credits/pricing` (`freeActiveListings`); add "tin đã đóng/hết hạn giữ chỗ thêm 7 ngày" to the pricing note (expose `slotCooldownDays`).
- Parked: hard-deleting a job frees the slot at once (deleted docs cannot be counted).

## Task 2 - Job stats (server + client) [A]
- `Job` model: `viewCount: Number default 0`, `featuredViewCount: Number default 0` (views while featured).
- `GET /api/jobs/:id`: when the viewer is not the owner/admin, `$inc` viewCount (and featuredViewCount if `isJobFeatured`) fire-and-forget; skip bots without a user agent. ponytail: no per-user dedupe; upgrade to a daily unique set if counts get gamed.
- `GET /api/jobs/employer/my-jobs`: include `viewCount`, `featuredViewCount`, `applicationCount` (one aggregate on Application grouped by jobId for the page).
- `EmployerJobsPage.jsx`: per job show "👁 N lượt xem · M ứng tuyển"; on a featured job show "Nổi bật: K lượt xem". On a non-featured approved job with views, a soft upsell line linking to FeatureJobModal.
- Tests: view by another user increments, owner view does not; my-jobs returns the three counts.

## Task 3 - TopCV-style job search page + featured visibility (client) [B]
Reference: topcv.vn/tim-viec-lam-moi-nhat (checked 2026-10-13). Their layout: brand-colour search band (keyword + location + button), quick category tiles, left sidebar of checkbox filters, right column of wide horizontal job rows, sort select above the list. Paid rows get a tinted brand background + brand border; normal rows are plain white.
- `JobListPage.jsx` layout (desktop >= 1024px): full-width green search band (search + area select + "Tìm kiếm"); below it a 2-column grid: left 280px filter sidebar (type, area, min salary, "Đã xác minh", "Nổi bật" as checkboxes/radios with counts where cheap), right the results column with "Sắp xếp theo" select and a "Danh sách | Bản đồ" toggle. Mobile: search band, filter button opening a sheet, rows full width.
- New `JobRow.jsx` (replaces `JobCard` on this page only; keep `JobCard` for HomePage/other users until migrated): 
  - left 64px logo box (store logo or initials avatar),
  - title (1-2 lines, bold), store name (muted, uppercase small),
  - chips: area, type/ca, distance when known,
  - salary right-aligned in brand green ("25.000đ/giờ" or "Thoả thuận"),
  - bottom meta row: posted time ("Đăng 2 ngày trước") + heart save button.
  - Featured row: brand-tinted background, brand border, small "Nổi bật" label; normal rows plain white with gray border. No other badges in the row.
- Featured at top: up to 3 featured rows first under the default sort ("Phù hợp"/newest); for `nearest`, `salary_*`, `oldest` keep the user's order (no pin) but featured rows stay tinted.
- Pagination: 20 rows per page with "Xem thêm" instead of rendering 200 rows.
- Map mode keeps `JobMap.jsx`: featured jobs get a distinct marker (brand pink, larger, star, highest z-index); popup shows "Nổi bật".
- `HomePage.jsx`: the featured section shows only jobs with `featured: true`; falls back to newest with the heading "Việc mới" when none.
- Load the ui-ux-pro-max rules (by hand): 375px mobile check, 44px touch targets, visible keyboard focus on rows, `prefers-reduced-motion`, contrast >= 4.5:1 on tinted rows.
- Do not copy TopCV assets/branding; only the layout pattern, in Hoa Lạc Việc colours.

## Task 4 - Push to students when a job becomes featured [C]
- New `notifyFeaturedJob(job)` in `jobAlertService.js`: recipients = job-alert matches (existing `alertMatchesJob`) plus active students whose profile location is within 3 km of the job (`$near` on the existing 2dsphere point) ; dedupe users, cap 300, skip the owner.
- Each recipient: in-app Notification ("Việc nổi bật gần bạn ⭐") + `sendPushToUser` when push is configured; errors swallowed.
- Trigger once per boost: at `/api/credits/jobs/:id/feature` when the job is approved (featuredUntil set now), and in `applyApprovalWindow` callers when pending featured days activate. Store `featuredNotifiedAt` on Job; skip if notified within the last 24h (repeat boosts do not spam).
- `FeatureJobModal.jsx`: copy states the benefit ("Ghim đầu danh sách, nổi bật trên bản đồ, gửi thông báo tới sinh viên gần quán").
- Tests: feature an approved job -> notifications for alert match + nearby student, none for far student/owner; second boost within 24h sends none.

## Review groups
- G1: Task 1 + Task 2 server (money/quota). G2: Task 2 client + Task 3 (UI). G3: Task 4.
