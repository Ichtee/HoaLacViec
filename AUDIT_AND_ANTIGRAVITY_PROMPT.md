# Rà soát dự án Hoa Lạc Việc và prompt sửa bằng Antigravity

Ngày rà soát: 21/09/2026  
Phạm vi: toàn bộ `client/srh theo ca, khoảng cách, điểm danh và chợ việc vặt sinh viên. Frontend đã có đủ màn hình cho c`, `server/src`, cấu hình build/deploy và mô hình dữ liệu hiện có.

## 1. Kết luận ngắn

Hoa Lạc Việc có hướng sản phẩm khá rõ và có điểm khác biệt tốt so với job board phổ thông: bản đồ việc làm siêu địa phương, lịch rảnbốn khu vực public/student/employer/admin và production build thành công.

Tuy nhiên, phiên bản hiện tại chưa an toàn để dùng với dữ liệu/người dùng thật. Đây vẫn là prototype có giao diện tốt hơn là một hệ thống tuyển dụng hoàn chỉnh. Vấn đề lớn nhất không phải thiếu vài nút nhỏ mà là:

- Backend gần như không có authentication/authorization cho các API nghiệp vụ.
- Mật khẩu lưu plaintext, JWT có secret dự phòng cố định.
- Client và server dùng lẫn `User._id` với `StudentProfile._id`/`EmployerProfile._id`, làm hỏng lưu việc, ứng tuyển và tính độ phù hợp.
- Nhiều tính năng admin/xác minh/báo cáo/khóa tài khoản chỉ là giao diện hoặc stub.
- Quy trình duyệt ứng viên → phân ca → GPS check-in → duyệt công → đánh giá chưa nối được thành một vòng nghiệp vụ thật.
- Nhiều badge và thông báo khẳng định “đã xác thực/GPS hợp lệ” dù hệ thống chưa thực hiện việc xác thực đó.

## 2. So sánh với các sản phẩm/dự án cùng chủ đề

Nguồn đối chiếu chính:

- [TopCV cho nhà tuyển dụng](https://tuyendung.topcv.vn/): xác thực doanh nghiệp trước khi đăng tin, sàng lọc CV, quản lý chiến dịch và báo cáo.
- [TopCV – tìm việc và ứng tuyển](https://www.topcv.vn/faqs/find-job-and-apply/): theo dõi hồ sơ, chat/kết nối nhà tuyển dụng, gợi ý và thông báo việc làm.
- [TopCV – xác thực tài khoản nhà tuyển dụng](https://tuyendung.topcv.vn/help/huong-dan-su-dung/xac-thuc-thong-tin-de-dang-tin-tuyen-dung/): xác thực số điện thoại bằng OTP và thông tin doanh nghiệp trước khi dùng tính năng tuyển dụng.
- [LinkedIn Jobs](https://www.linkedin.com/help/linkedin/answer/a511260/linkedin-help-center?lang=en): tìm kiếm/lọc, lưu việc, Easy Apply và Apply ngoài hệ thống.
- [LinkedIn Job Alerts](https://www.linkedin.com/help/linkedin/answer/a511279/job-alerts-on-linkedin?lang=en): cảnh báo theo truy vấn qua email/thông báo.
- [LinkedIn Job Tracker](https://www.linkedin.com/help/linkedin/answer/a8684146): theo dõi saved/in progress/applied/interview/archive và ghi chú.
- [Workable candidate pipeline](https://help.workable.com/hc/en-us/articles/115012857047-Candidate-profile-in-pipeline-view-overview): CV, câu hỏi sàng lọc, timeline, giao tiếp, lịch phỏng vấn, đánh giá và offer.
- [MERN Job Portal của b30wulffz](https://github.com/b30wulffz/job-portal): API có JWT protection, recruiter CRUD việc, quản lý ứng viên, resume và hồ sơ.
- [MERN Job Portal của git-senpai](https://github.com/git-senpai/JobPortal): role-based auth, resume upload, application tracking, moderation và analytics.

| Nhóm chức năng | Nền tảng tuyển dụng thông thường | Hoa Lạc Việc hiện tại | Đánh giá |
|---|---|---|---|
| Đăng ký/đăng nhập | Hash mật khẩu, verify email/phone, reset password, khóa/rate-limit | Plaintext, không verify, quên mật khẩu chỉ `alert`, không rate-limit | Nguy hiểm, P0 |
| Phân quyền | API kiểm tra JWT, role và ownership | Chủ yếu chỉ guard ở React; API nghiệp vụ mở | Nguy hiểm, P0 |
| Hồ sơ ứng viên | Thông tin học tập/kỹ năng/kinh nghiệm, CV/resume, quyền riêng tư | Có UI kỹ năng/lịch rảnh nhưng thiếu CV; nhiều field UI không có trong schema | Một phần |
| Hồ sơ doanh nghiệp | Pháp lý, hình ảnh, trạng thái xác minh, audit | Badge xác thực hard-code; schema thiếu GPKD/tài liệu/trạng thái/reason | Gần như giả lập |
| Đăng/duyệt tin | Draft → pending moderation → published/closed/expired | Tin mới tự `approved`; bất kỳ ai có thể tạo/sửa/xóa | Sai quy trình, P0 |
| Tìm kiếm/lọc | Search, địa điểm, loại việc, lương, ngày đăng, verified, phân trang | Có UI cơ bản; `verified` bị backend bỏ qua, phân trang client trên tối đa 50 kết quả | Một phần |
| Việc gần bạn | Thường có lọc địa điểm; một số app có jobs near you | Có bản đồ, GPS và khoảng cách | Điểm mạnh |
| Ghép lịch | Thường là recommendation theo hồ sơ | Ý tưởng tốt nhưng form không lưu `schedule`; điểm mặc định 80 tạo cảm giác khớp giả | Chưa chạy đúng |
| Lưu việc | Lưu theo tài khoản, đồng bộ thiết bị | localStorage dùng chung; sai chữ ký hàm nên thao tác/page lưu bị hỏng | Hỏng |
| Ứng tuyển | CV, cover letter, câu hỏi, consent dữ liệu, chống nộp trùng | Chỉ tên/phone/note; dùng sai `profileId`; API tin dữ liệu client | Hỏng/thiếu |
| Pipeline tuyển dụng | Applied → screening → interview → offer → hired/rejected | pending/approved/rejected; “Trúng tuyển & Phân ca” không tạo ca | Thiếu lớn |
| Liên lạc/thông báo | In-app/email notification, chat hoặc message history | Phone/Zalo trực tiếp, không có notification/timeline | Một phần |
| Phân ca/chấm công | Gắn đúng nhân viên, time window, trạng thái, duyệt giờ công | Form hard-code tên/ngày, không gửi `studentId`; GPS luôn true | Hỏng/nguy hiểm |
| Đánh giá | Chỉ sau giao dịch/ca hoàn tất, chống review trùng, cập nhật rating | Ai cũng POST review và giả reviewer; UI không gửi review; rating không tổng hợp | Hỏng |
| Báo cáo/lừa đảo | Người dùng report; admin có queue, evidence, resolution/audit | Service trả `[]`; không có model/API | Chưa có |
| Khóa tài khoản | Admin action thật, chặn login/token | Chỉ đổi state cục bộ trên màn hình admin | Giả lập |
| Job alerts/recommendations | Saved search, daily/weekly alerts, cá nhân hóa | Chưa có | Thiếu |
| Admin analytics/audit | Số liệu server, moderation history, audit logs | Đếm từ các danh sách tải về; không audit | Thiếu |

## 3. Các lỗi đã xác nhận trong mã nguồn

### P0 – phải sửa trước khi cho người dùng thật sử dụng

1. **Toàn bộ API nghiệp vụ thiếu auth và ownership.** Không có middleware xác thực dùng chung. `adminRoutes.js` cho phép bất kỳ ai xem user, sửa job, duyệt doanh nghiệp. Tương tự, bất kỳ ai có ID đều có thể sửa profile, đơn, ca, review, task hoặc xóa job.

2. **Mật khẩu plaintext.** `server/src/models/User.js:6` lưu thẳng password và còn có mặc định `123456`; `server/src/routes/authRoutes.js:31` so sánh chuỗi trực tiếp. Dù `bcryptjs` đã cài, mã không dùng.

3. **JWT không an toàn.** `server/src/routes/authRoutes.js:12` dùng fallback `secret`; token 7 ngày; không refresh rotation, không revoke, không kiểm tra trạng thái tài khoản. Chỉ `/auth/me` xác minh JWT, các API còn lại bỏ qua token.

4. **Có thể tự đăng ký admin.** Backend lấy `role` trực tiếp từ body (`authRoutes.js:64,78`) và schema cho phép `admin`.

5. **CORS thực tế cho phép mọi origin.** Nhánh từ chối ở `server/src/index.js:37` vẫn gọi `callback(null, true)`.

6. **Rò dữ liệu cá nhân/IDOR.** `GET /api/admin/users` công khai danh sách tài khoản; `GET /api/applications` không cần đăng nhập và trả phone/email ứng viên; profile/availability/shifts/reviews/tasks cũng có thể truy vấn tùy ý.

7. **Mass assignment.** Profile PUT nhận nguyên `req.body`; employer có thể tự gửi `{ verified: true }`. Job/application/shift/admin update cũng nhận dữ liệu không allowlist và nhiều update không bật `runValidators: true`.

8. **SSRF ở resolve map link.** `parseMapLink.js:61-88` cho server fetch một URL bất kỳ do client cung cấp, có thể bị dùng để gọi tài nguyên nội bộ hoặc tải response quá lớn.

9. **Tin tuyển dụng tự được duyệt.** `Job.status` mặc định approved; route POST map status trống/active thành approved; UI employer cũng gửi approved. Không có điều kiện doanh nghiệp đã xác minh.

10. **Sai ID làm hỏng ứng tuyển và matching.** `JobDetailPage.jsx:47-53,79` dùng `profileId` trong khi API profile/availability/application dùng `User._id`. Sau đó trang `ApplicationsPage.jsx:30` lại tìm bằng `user.id`, nên đơn vừa nộp có thể không xuất hiện cho sinh viên.

11. **GPS check-in là khẳng định giả.** Backend `shiftRoutes.js:73-78` luôn đặt `locationVerified: true`; frontend không lấy vị trí khi check-in nhưng thông báo rằng tọa độ đã trùng cửa hàng. Người lạ cũng có thể check-in/out ca bất kỳ nếu biết ID.

12. **Quy trình phân ca không tạo được ca cho sinh viên.** Duyệt “Trúng tuyển & Phân ca” chỉ đổi application status. Form tạo ca dùng tên/ngày hard-code và không gửi `studentId`, nên trang ca của sinh viên truy vấn theo `user.id` sẽ không thấy ca.

### P1 – chức năng chính đang sai hoặc chưa hoàn chỉnh

1. **Lưu việc bị hỏng ở ba nơi.** Service `toggleSaveJob(jobId)` chỉ nhận một tham số và trả boolean, nhưng JobList/JobDetail gọi `(profileId, jobId)` rồi đọc `result.saved`. Vì vậy nó lưu nhầm profile ID. `SavedJobsPage` lại coi danh sách job là danh sách ID và coi array API là object có `.jobs`, nên thường luôn rỗng. Dữ liệu localStorage còn dùng chung giữa các tài khoản/máy không đồng bộ.

2. **Bộ lọc verified không hoạt động.** Client gửi `verified`, backend không đọc. `category` được đọc trong route nhưng không áp dụng. Khi vừa lọc employer vừa search, `filter.$or` của search ghi đè điều kiện ownership/store.

3. **Phân trang giả.** Server giới hạn mặc định 50 rồi trả `total: jobs.length`; client cắt page từ danh sách đó. Không có `page/skip/totalCount`, nên không thể xem quá 50 và số tổng sai.

4. **Public có thể mở draft/rejected bằng ID.** `GET /api/jobs/:id` không giới hạn status hay quyền chủ sở hữu/admin.

5. **Matching lịch chưa có dữ liệu thật.** UI đăng tin gửi `shiftDetail`, nhưng `Job` schema không có field này và UI không tạo `schedule`. Hàm matching dùng baseline 80 khi thiếu dữ liệu, làm điểm số trông đáng tin dù chưa được tính từ lịch.

6. **Form đăng tin bỏ mất quyền lợi.** `EmployerJobsPage.jsx:530` luôn gửi `benefits: []` dù form có state benefits. Thiếu `closesAt`, ngày bắt đầu, số giờ/tuần, yêu cầu tuổi, cách trả lương và câu hỏi sàng lọc.

7. **Hồ sơ doanh nghiệp lệch schema.** UI dùng `phone`, `email`, `category`, `businessLicense`, `verificationStatus`, `openingHours`, `wageRange`; schema chủ yếu dùng `contactPhone`, `storeType` và không có tài liệu pháp lý. Nhiều giá trị sẽ bị Mongoose bỏ qua. UI luôn hiện “ĐÃ XÁC THỰC”.

8. **Hồ sơ sinh viên lệch schema.** UI dùng `name/email/phone/experience`, nhưng profile schema không có các field này; thay đổi không cập nhật `User`. Badge “Đã xác thực SV” luôn hiện dù không có quy trình xác minh sinh viên.

9. **Verification admin không khớp dữ liệu.** API trả `_id`, `verified`; UI cần `id`, `status`, `businessLicense`, `submittedAt`. Reject gọi service no-op. Không có upload/preview giấy tờ, lý do từ chối, resubmit hay audit.

10. **Admin khóa user là giả.** `AdminUsersPage` chỉ đổi state cục bộ; model User không có status và không có API lock/unlock. UI còn dùng `user.id` trong khi Mongo trả `_id`.

11. **Reports là stub.** `getReports = async () => []`, `resolveReport` luôn báo resolved; không có model/route/form gửi báo cáo.

12. **Review không đáng tin.** POST nhận `reviewerId`, `reviewerRole`, `reviewerName` từ client; không gắn application/shift/task hoàn tất; không chống trùng; không cập nhật điểm tổng. Trang sinh viên import `createReview` nhưng không có UI tạo review.

13. **Micro-task thiếu quyền và state machine.** Ai cũng có thể nhận/complete/delete; thao tác accept không atomic nên có race; mọi người đều thấy phone; nút “Đã xong” hiện cho mọi viewer; deadline là text tự do.

14. **Ứng tuyển không kiểm tra điều kiện.** Không kiểm tra job approved/chưa hết hạn/chưa đủ slot; chống trùng không có unique index nên race vẫn tạo trùng; tên/phone/email lấy từ client nên giả mạo được.

15. **Application status chưa có state machine.** Bất kỳ status nào có thể được update bằng route chung; student có thể tự duyệt nếu gọi API. Không có shortlist/interview/offer/hired, lịch phỏng vấn hay history.

16. **Redirect sau login bị mất.** Các trang dùng query `?redirect=...`, nhưng Login chỉ đọc `location.state.from`.

17. **Quên mật khẩu chưa tồn tại.** Link chỉ hiện alert yêu cầu gửi email hỗ trợ.

### P2 – chất lượng, vận hành và tiểu tiết

- Không có test backend/frontend/E2E, không có script test.
- Lint chạy nhưng có rất nhiều warning: unused imports/state, hook dependency, purity/ref warnings.
- Bundle JS production khoảng 703 KB minified; chưa route-based code splitting.
- Vite cảnh báo dùng `__dirname` không tương thích config loader tương lai.
- Health endpoint luôn ghi `database: MongoDB Connected` thay vì kiểm tra trạng thái thật.
- Backend trả `err.message` cho client, có thể lộ chi tiết nội bộ; status lỗi thường dùng 500 cho validation/duplicate ID.
- Không có request schema validation, chuẩn lỗi thống nhất, pagination contract, OpenAPI hoặc versioning.
- Thiếu transaction cho register + profile, accept task, hire + create shift và các cập nhật rating/capacity.
- Thiếu index cho truy vấn thường dùng và unique cho profile/application/review.
- Không có notification center/email notification/job alert.
- Không có CV/resume upload, ảnh đại diện/cửa hàng thật, timeline ứng tuyển hay lịch phỏng vấn.
- Không có điều khoản sử dụng, chính sách riêng tư, consent chia sẻ dữ liệu khi ứng tuyển, xóa/tải dữ liệu tài khoản.
- SEO chỉ có title tĩnh; thiếu description/Open Graph, canonical, structured data `JobPosting`, sitemap/robots và title/meta theo trang.
- Modal chưa trap focus/restore focus; form error chưa nối `aria-describedby`/`aria-invalid`; cần rà contrast, keyboard và live region.
- Nhiều ngày/số điện thoại/tên người hard-code; ngày tạo ca mặc định đã ở quá khứ tại thời điểm audit.
- README bị mojibake khi đọc bằng encoding mặc định và mô tả một số chức năng như GPS/matching như đã hoàn chỉnh dù thực tế chưa đúng.

## 4. Chính sách tài khoản/password nên dùng

Không nên ép kiểu cũ “phải có chữ hoa + chữ thường + số + ký tự đặc biệt”. NIST/OWASP hiện ưu tiên độ dài, blocklist và rate limiting hơn composition rule:

- Password tối thiểu 15 ký tự nếu chưa có MFA; hỗ trợ passphrase và tối đa ít nhất 64 ký tự.
- Cho phép Unicode, khoảng trắng và paste/password manager; không silently truncate.
- Chặn password phổ biến/rò rỉ; có strength meter ở client nhưng backend mới là nguồn quyết định.
- Hash bằng Argon2id; nếu muốn tận dụng dependency hiện tại thì bcrypt cost >= 10 là mức chuyển tiếp chấp nhận được.
- Login trả lỗi chung để tránh dò email; rate-limit theo IP + account; log sự kiện bảo mật nhưng không log password/token.
- Verify email bằng token một lần, lưu hash token và expiry; resend có cooldown.
- Forgot/reset password trả thông báo chung, token một lần, hết hạn ngắn, thu hồi session/token cũ sau reset.
- Change password yêu cầu mật khẩu hiện tại; thay email phải verify địa chỉ mới.
- Admin lock/suspend phải chặn login và API, đồng thời revoke session.

Tham chiếu: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP Email Verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html).

## 5. Kết quả kiểm tra tự động hiện tại

- `client/npm run build`: pass.
- Production bundle chính: khoảng 702.93 KB minified, 194.01 KB gzip; Vite cảnh báo chunk > 500 KB.
- `client/npm run lint`: exit code 0 nhưng có nhiều warning React/Oxlint.
- Server không có test/lint script; toàn repo không có Jest/Vitest/Supertest/Cypress/Playwright test.
- Git worktree sạch tại thời điểm bắt đầu audit; tài liệu audit này là file mới duy nhất được tạo.

---

# PROMPT DÁN SANG ANTIGRAVITY

```text
Bạn là senior full-stack engineer kiêm application security engineer. Hãy làm việc trực tiếp trong repository HoaLacViec hiện tại (React 19 + Vite + Tailwind ở client; Node/Express + Mongoose/MongoDB ở server). Nhiệm vụ là biến prototype thành một MVP tuyển dụng part-time có nghiệp vụ thật, bảo mật đúng và không còn tính năng giả lập.

MỤC TIÊU
1. Sửa các lỗi P0/P1 dưới đây, ưu tiên bảo mật và tính đúng dữ liệu trước UI mới.
2. Giữ phong cách giao diện/branding hiện có và các điểm riêng: Hòa Lạc, bản đồ, lịch rảnh theo ca, việc vặt sinh viên.
3. Không hard-code dữ liệu demo trong production, không trả Promise giả/no-op, không hiển thị badge/thông báo xác minh nếu server chưa xác minh thật.
4. Không chỉ sửa frontend để che lỗi backend. Mọi quyền, validation, state transition và ownership phải được server cưỡng chế.
5. Thực hiện migration/seed tương thích thay vì xóa database. Không phá dữ liệu hiện có.

TRƯỚC KHI CODE
- Đọc toàn bộ README, package.json, models, routes, service layer, auth hook và các page.
- Lập checklist ngắn theo phase; sau mỗi phase chạy test/lint/build và sửa lỗi trước khi sang phase tiếp.
- Nếu đổi schema, tạo script migration idempotent và ghi rõ cách chạy/rollback hợp lý.

PHASE 1 — AUTH, SECURITY, VALIDATION (P0)

A. Tạo middleware chuẩn:
- `authenticate`: verify JWT/session, load user hiện tại, chặn deleted/locked/suspended/unverified theo policy.
- `authorize(...roles)`.
- Resource ownership helpers cho job/application/profile/shift/task/review.
- ID phải lấy từ `req.user.id`; không tin `studentId`, `employerId`, reviewerId/requesterId/assigneeId từ body/query cho thao tác riêng tư.
- Public chỉ được đọc job `approved` chưa hết hạn và blog published. Route admin chỉ admin; employer chỉ tài nguyên của mình; student chỉ hồ sơ/đơn/ca của mình.

B. Sửa auth:
- Không cho public chọn role `admin`; chỉ `student|employer`.
- Bỏ password default và plaintext. Dùng Argon2id nếu phù hợp; nếu giữ bcryptjs thì cost >= 10. Hash ở model/service và compare an toàn.
- Viết migration idempotent để hash password plaintext hiện có; seed phải tạo password hash và đánh dấu account seed đã verify. Không log plaintext.
- Production phải fail fast nếu thiếu `JWT_SECRET`; không có fallback `secret`.
- Access token ngắn hạn + refresh token rotation lưu hash/revocation; refresh cookie HttpOnly/Secure/SameSite phù hợp kiến trúc Vercel ↔ Render và có CSRF protection cần thiết. Logout/revoke thực sự.
- `GET /auth/me` là nguồn phục hồi session. Client không tin role/user sửa trong localStorage. Không lưu refresh token trong localStorage.
- User có `status` (active/locked/suspended/deleted), `emailVerifiedAt`, tokenVersion/session metadata cần thiết.
- Login error chung, chống user enumeration; rate-limit login/register/forgot/resend và API tốn quota; thêm Helmet, CORS allowlist đúng, request size limit, centralized error handler không lộ lỗi nội bộ.

C. Account verification và password lifecycle:
- Backend validation: email normalize/validate nhất quán; phone Việt Nam normalize E.164; name/length allowlist.
- Password: min 15, max 128, cho phép Unicode/space, không ép uppercase/special; chặn danh sách password phổ biến; client có strength meter nhưng backend quyết định.
- Implement verify email bằng token random một lần: chỉ lưu hash token + expiry, resend cooldown, generic response. Tạo mail service qua SMTP env; nếu thiếu cấu hình thì không được giả báo đã gửi. Test dùng injected fake mailer.
- Implement forgot/reset password tương tự, token một lần/hết hạn, revoke sessions sau reset.
- Implement change password (yêu cầu password cũ), change email (verify email mới).
- Employer phone OTP có provider abstraction. Nếu chưa có SMS provider, UI phải ghi rõ chưa khả dụng/cấu hình thiếu; tuyệt đối không auto-verified.

D. Validation và hạ tầng:
- Dùng Zod/Joi/express-validator thống nhất cho params/query/body; allowlist field update; bật `runValidators: true`.
- Chuẩn hóa HTTP status và error shape `{ code, message, fieldErrors?, requestId }`.
- Validate ObjectId trước query. Escape regex hoặc dùng text index; chặn ReDoS.
- Fix CORS nhánh từ chối.
- Fix `/health` phản ánh đúng `mongoose.connection.readyState`; tách readiness/liveness nếu cần.
- Khóa endpoint SerpApi và áp quota/cache TTL theo user/IP.
- Loại SSRF ở resolve map link: chỉ allowlist hostname Google Maps hợp lệ, chỉ http/https, resolve DNS rồi chặn loopback/private/link-local/metadata IP, timeout, size limit, redirect limit; hoặc chuyển sang API chính thức an toàn.

PHASE 2 — CHUẨN HÓA DATA MODEL VÀ NGHIỆP VỤ TUYỂN DỤNG

A. Một hệ ID duy nhất:
- `User._id` là actor ID trong auth, application, saved job, shift, task, review.
- `StudentProfile.userId` và `EmployerProfile.userId` unique.
- Job phải có `employerUserId: ref User`; nếu cần giữ profile thì dùng field riêng `employerProfileId`, không dùng một field lúc ref User lúc ref EmployerProfile.
- Migration chuyển dữ liệu cũ an toàn; sửa toàn bộ query/client để không trộn `profileId` và `user.id`.

B. Employer verification thật:
- Tạo `EmployerVerification` riêng: employerUserId, legalName/storeName, tax/business license number, contact, address, document metadata/private URL, status `draft|pending|approved|rejected|needs_changes`, submittedAt/reviewedAt/reviewerId/reason/audit history.
- Upload chỉ PDF/JPG/PNG, giới hạn MIME/size, tên file random, private access; không tin extension. Tạo storage abstraction (local private dev + cloud provider production).
- Employer submit/resubmit; admin preview có authorization, approve/reject/needs_changes kèm lý do.
- Employer không thể tự sửa verified/status/reviewer fields.
- Chỉ employer approved mới được submit job để publish. Badge đọc từ server status, không hard-code.

C. Job lifecycle:
- Status server-owned: `draft -> pending_review -> approved -> paused/closed/expired/rejected`; lưu moderation reason/history.
- Employer tạo draft hoặc submit pending; không được tự gửi approved/featured.
- Admin duyệt/từ chối; employer chỉ sửa/xóa mềm job của mình. Nếu sửa nội dung quan trọng của job approved thì quay lại pending_review.
- GET public detail không trả draft/rejected; owner/admin vẫn xem được.
- Thêm/chuẩn hóa: title, description, requirements, benefits, type, salary min/max hoặc amount + unit, slots, structured schedule, start date, closesAt, address/GeoJSON location, contact policy, screening questions.
- Fix form hiện tại đang gửi `shiftDetail` không có trong schema và luôn gửi `benefits: []`.
- Tự expire job quá hạn. Không nhận application khi job không approved, hết hạn hoặc đã đóng/đủ slot theo policy.

D. Search/list:
- Server-side pagination `page, limit` có cap; trả `{ items, page, limit, totalItems, totalPages }`.
- Server-side filter/sort: keyword, area/distance, type, salary, schedule, verified employer, posted date; giữ kết hợp điều kiện `$and/$or` đúng, không để search ghi đè employer filter.
- `verifiedOnly` phải hoạt động thật qua employer verification.
- Tạo index cần thiết; không tính `total` từ mảng đã limit.
- Matching chỉ hiển thị khi có dữ liệu thật. Structured schedule so khớp interval/day; distance dùng tọa độ hợp lệ. Nếu thiếu dữ liệu phải nói “chưa đủ dữ liệu”, không baseline 80 giả.

E. Student profile/CV:
- Tách field account (name/email/phone/avatar) và profile (university, studentCode, major, year, skills, bio, experience, education, availability, transport/location).
- Có cơ chế xác minh sinh viên thật (email trường hoặc giấy tờ với status); badge theo server, không hard-code.
- Upload CV PDF/DOC/DOCX an toàn, version/current resume, quyền private; application lưu snapshot/link CV tại thời điểm nộp.
- Cho người dùng kiểm soát visibility và consent chia sẻ contact/CV.

PHASE 3 — APPLICATION PIPELINE, SAVED JOBS, NOTIFICATION

A. Application:
- `POST /applications/:jobId` lấy student từ token; validate profile/contact/CV; lưu application snapshot.
- Compound unique index cho `(studentUserId, jobId)` và định nghĩa rõ policy reapply; xử lý race/duplicate bằng 409.
- Pipeline có state machine tối thiểu: `submitted -> reviewing -> shortlisted -> interview -> offered -> hired` hoặc `rejected/withdrawn`. Chỉ employer owner chuyển các trạng thái tuyển dụng; student chỉ withdraw ở trạng thái cho phép.
- Có status history gồm actor/time/note; employer internal note tách candidate-visible message.
- Hỗ trợ câu hỏi sàng lọc, lịch phỏng vấn và phản hồi. UI hiển thị timeline.
- Khi hired, transaction cập nhật application/capacity và tạo/cho phép tạo shift gắn đúng `studentUserId`; nút “Trúng tuyển & Phân ca” phải làm đúng lời hứa hoặc đổi label.

B. Saved jobs:
- Tạo server model/API saved job theo `userId + jobId`, unique, sync đa thiết bị.
- Sửa toàn bộ lỗi signature hiện tại: service không được nhận thừa `(profileId, jobId)` rồi lưu profileId; thống nhất return contract.
- Sửa SavedJobsPage đang coi list job là list ID và coi array là `{jobs}`.
- Saved closed/expired job vẫn có thể hiện với badge trạng thái; không mất âm thầm.

C. Notification/job alert:
- Tạo notification model/read-unread cho application status, interview/shift, verification, moderation.
- Job alert theo tiêu chí search, tần suất daily/weekly; email optional qua mail service. Có unsubscribe/preferences.
- Không cần chat realtime ở MVP nếu phone/Zalo đủ, nhưng phải có candidate-visible message history và notification khi trạng thái thay đổi.

PHASE 4 — SHIFT, GPS ATTENDANCE, REVIEW, MICRO-TASK

A. Shift/attendance:
- Shift bắt buộc employerUserId, studentUserId, nguồn application/job, startAt/endAt theo timezone Asia/Bangkok, wageRate và trạng thái chuẩn.
- Employer chọn từ ứng viên hired; bỏ tên/ngày hard-code và không cho tạo ca không có student ID.
- State machine: scheduled -> checked_in -> checked_out -> pending_approval -> approved/disputed/cancelled/absent. Không checkout trước checkin, không lặp action, lưu history.
- Client xin geolocation đúng lúc với consent và gửi lat/lng/accuracy/time. Server tự tính Haversine so với địa điểm job/profile và radius; kiểm tra time window, accuracy threshold, replay/idempotency. Không bao giờ nhận `locationVerified` từ client hoặc set true vô điều kiện.
- GPS không phải bằng chứng tuyệt đối: lưu distance/accuracy và cho employer dispute/manual approve có audit.
- Tính worked minutes/pay ở server từ timestamps và break/overtime policy; không tin `hours` client.

B. Review:
- Review chỉ tạo sau shift/task completed/approved; gắn transaction ID; mỗi bên tối đa một review cho một giao dịch.
- Reviewer/role lấy từ token; target suy ra từ transaction; chống self-review.
- Cập nhật aggregate rating/count transactionally hoặc tính từ aggregation; có report/moderation.
- Hoàn thiện UI gửi review thật; sửa semantics received/given theo viewer thay vì field mơ hồ.

C. Micro-task:
- Tất cả create/accept/complete/cancel dùng auth + ownership.
- Accept atomic (`findOneAndUpdate` status open) để chỉ một người nhận.
- State machine và quyền rõ: requester cancel/confirm complete; assignee mark done; có dispute/report.
- Phone/contact chỉ lộ cho requester và assignee sau accept; public list không trả phone.
- Deadline là Date, reward > 0 có min/max; không hard-code số điện thoại demo.

PHASE 5 — ADMIN, REPORTS, PRIVACY, UX

A. Admin thật:
- User lock/unlock/suspend API thật, reason + audit; chặn login/API và revoke session.
- Report model/API/form cho job/employer/student/task/review: category, description, evidence, status, assignee admin, resolution, history.
- Admin moderation pages lấy dữ liệu server có pagination/filter; mọi action có confirm, loading/error, reason và audit log.
- Dashboard lấy aggregate endpoint thay vì tải toàn bộ list rồi `.length`.
- Blog create/update/delete chỉ admin; có draft/published và sanitize content để chống XSS.

B. Privacy/safety:
- Thêm Điều khoản, Chính sách riêng tư, consent cụ thể khi chia sẻ CV/contact; link report scam ở job detail.
- API không trả PII dư thừa. Mask phone/email ở nơi chưa được phép.
- Có account data export/delete/deactivate cơ bản và retention policy; soft delete dữ liệu nghiệp vụ cần audit.
- Không log token, password, OTP, CV URL private hay PII đầy đủ.

C. Frontend correctness/UX:
- AuthProvider gọi `/auth/me` lúc bootstrap, có trạng thái initializing; xử lý 401 tập trung và refresh token an toàn.
- Fix redirect: hỗ trợ cả router state và query `redirect`, nhưng chỉ cho internal relative URL để tránh open redirect.
- CTA theo role: employer/admin không mở modal ứng tuyển; guest được đưa về login rồi quay lại đúng trang.
- Bỏ mọi badge “đã xác thực”, text “GPS đã trùng”, ngày/tên/phone mặc định nếu server chưa xác nhận.
- Chuẩn loading/error/empty/toast; optimistic update chỉ khi có rollback/error handling.
- Error field nối `aria-invalid`/`aria-describedby`; modal trap focus, restore focus; keyboard đầy đủ; toast dùng live region.
- Dynamic title/meta, description/OG/canonical; JSON-LD `JobPosting` chỉ cho job approved; sitemap/robots.
- Route-based lazy loading/code splitting để giảm bundle.

TEST VÀ ACCEPTANCE CRITERIA BẮT BUỘC

1. Thêm server test (Node test/Vitest/Jest + Supertest + test DB) và frontend component/integration test; thêm E2E Playwright cho happy paths chính.
2. Test auth: hash không plaintext; không đăng ký admin; unverified/locked behavior; verify/reset token one-time/expiry; rate limit; refresh rotation/reuse detection.
3. Test authorization/IDOR cho từng role: user A không đọc/sửa/xóa tài nguyên riêng của user B; employer không thao tác job/application/shift của employer khác; non-admin bị 403 ở admin API.
4. Test job lifecycle, public visibility, validation, pagination/filter, deadline/capacity.
5. Test duplicate application race, allowed/forbidden state transitions và hire tạo đúng liên kết student.
6. Test saved job theo đúng user và reload/đổi tài khoản.
7. Test GPS: ngoài radius, ngoài time window, accuracy kém, checkout-before-checkin, duplicate request.
8. Test task atomic accept và quyền complete/cancel; review chỉ sau transaction hoàn tất và không trùng.
9. `npm run lint` phải không còn warning quan trọng; `npm run build` pass; test pass. Thêm scripts ở cả client/server/root hoặc hướng dẫn rõ.
10. API không còn endpoint mutation nhạy cảm không auth. Không còn plaintext password/default secret/fake service/no-op/admin local-only action/hard-coded verified badge.

DELIVERABLE CUỐI
- Code hoàn chỉnh, migration scripts, seed đã sửa, `.env.example` cập nhật, README setup/migration/security flow, API contract/OpenAPI tối thiểu.
- Báo cáo ngắn file nào đổi, schema migration nào cần chạy, biến môi trường cần thêm, test đã chạy và kết quả.
- Liệt kê rõ phần nào chưa thể chạy nếu thiếu SMTP/SMS/storage credential; không giả lập thành công. Cung cấp adapter và test double, nhưng production phải fail rõ hoặc disable UI đúng trạng thái.
- Không dừng ở việc mô tả. Hãy trực tiếp sửa code theo từng phase, chạy kiểm tra và tiếp tục cho đến khi các acceptance criteria trên đạt hoặc nêu blocker cụ thể có log/evidence.
```

