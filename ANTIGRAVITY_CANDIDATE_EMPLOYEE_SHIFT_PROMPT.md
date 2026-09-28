# Antigravity Prompt — Chuẩn hóa luồng Ứng viên → Nhân viên → Xếp ca

```text
Bạn là senior full-stack engineer kiêm business analyst cho hệ thống tuyển dụng và workforce scheduling. Hãy làm việc trực tiếp trong repository hiện tại của dự án Hoa Lạc Việc.

Stack hiện tại:
- Frontend: React + Vite + Tailwind.
- Backend: Node.js + Express + Mongoose/MongoDB.
- Các khu vực liên quan chính: Application, Job, Availability, Shift; trang ứng viên, nhân viên và xếp ca của employer; trang đơn ứng tuyển và ca làm của student.

MỤC TIÊU

Chuẩn hóa toàn bộ luồng:

Ứng viên nộp hồ sơ
→ nhà tuyển dụng sàng lọc/phỏng vấn
→ gửi đề nghị nhận việc
→ ứng viên chấp nhận hoặc từ chối
→ tạo quan hệ nhân viên độc lập
→ onboarding/đang làm/nghỉ việc
→ thu thập lịch rảnh và nghỉ phép
→ lập lịch nháp
→ kiểm tra xung đột
→ công bố lịch
→ nhân viên xác nhận
→ check-in/check-out
→ duyệt công
→ sẵn sàng tính lương/đã trả.

Đây là nhiệm vụ sửa code hoàn chỉnh, không chỉ viết kế hoạch hoặc mock UI.

NGUYÊN TẮC BẮT BUỘC

1. Đọc code thực tế trước khi sửa. Không giả định audit cũ còn đúng.
2. Giữ nguyên branding và UX tổng thể; chỉ thay đổi nơi cần thiết để nghiệp vụ đúng và dễ hiểu hơn.
3. Server là nguồn sự thật cho quyền, state transition, eligibility, capacity, conflict và tính công. Không chỉ kiểm tra ở frontend.
4. Không xóa database hoặc dữ liệu cũ. Mọi đổi schema phải có migration idempotent và chiến lược tương thích ngược trong thời gian chuyển đổi.
5. Không hard-delete hồ sơ tuyển dụng, quan hệ nhân viên, ca đã công bố hoặc bảng công cần audit.
6. Không dùng status legacy làm thiết kế chính. Có thể đọc dữ liệu legacy trong migration/compatibility layer nhưng dữ liệu mới phải dùng trạng thái chuẩn.
7. Không dùng `Application` làm bản ghi nhân viên.
8. Không tự ý mở rộng sang các module không liên quan như blog, micro-task, bản đồ hoặc redesign toàn hệ thống.
9. Trước khi code, kiểm tra worktree và bảo toàn mọi thay đổi hiện có của người dùng.
10. Sau mỗi phase, chạy test liên quan; cuối cùng chạy toàn bộ test, lint và build đang có trong repository.

HIỆN TRẠNG CẦN KHẮC PHỤC

- `Application.status = hired/accepted/approved` hiện đang được xem trực tiếp là nhân viên.
- Employer có thể chuyển ứng viên thẳng sang `hired`, chưa có offer và xác nhận của ứng viên.
- Trang nhân viên lọc từ application; nghỉ việc có thể hard-delete application hoặc đổi thành `rejected`.
- Khi `hired`, hệ thống giảm `Job.slots`, nhưng không hoàn lại khi đảo trạng thái/xóa và không transaction với application.
- `slots` vừa mang nghĩa chỉ tiêu ban đầu vừa mang nghĩa số chỗ còn lại; `positions[].quantity` không đồng bộ.
- Khi hết slot, job thành `closed`; màn hình xếp ca lại loại job `closed`, khiến mẫu ca biến mất đúng lúc đã tuyển đủ người.
- Màn hình xếp ca sinh slot của mọi job cho mọi ngày, chưa lọc đúng `schedule.dayOfWeek`.
- Availability đã tồn tại nhưng chưa được dùng khi xếp ca.
- Frontend chỉ cảnh báo một người đã có ca cùng ngày; backend chưa chặn hai ca giao nhau.
- Ca được tạo và thông báo ngay, chưa có draft/publish/acknowledge.
- Chưa có nghỉ phép, nhả ca, đổi ca hoặc ca trống.
- `approved` đang trộn duyệt công với đã chi trả lương.
- Shift status enum và đường chuyển trạng thái thực tế chưa thống nhất.
- Date/time chủ yếu là chuỗi rời, chưa xử lý tốt ca qua đêm và timezone.

KIẾN TRÚC NGHIỆP VỤ ĐÍCH

1. APPLICATION — chỉ quản lý quá trình tuyển dụng

State machine chuẩn:

`submitted -> screening -> shortlisted -> interview -> offer_sent -> offer_accepted -> hired`

Nhánh kết thúc:
- `rejected`: nhà tuyển dụng từ chối, kèm reason code/note.
- `withdrawn`: ứng viên rút trước khi nhận việc.
- `offer_declined`: ứng viên từ chối offer.
- `offer_expired`: hết hạn phản hồi.
- `offer_rescinded`: employer thu hồi offer trước khi được chấp nhận.

Yêu cầu:
- Không cho employer tự đánh dấu `offer_accepted`; hành động chấp nhận/từ chối thuộc về đúng ứng viên.
- `hired` chỉ xảy ra sau `offer_accepted` và khi tạo Employment thành công.
- Có thể cho employer bỏ qua shortlist/interview đối với công việc đơn giản, nhưng tuyệt đối không bỏ qua offer acceptance.
- Lưu `statusHistory` với from, to, actor, timestamp, reason và candidate-visible message nếu có.
- Internal note phải tách hoàn toàn với nội dung ứng viên được xem.
- Interview phải có lịch có cấu trúc: startAt, endAt, timezone, location hoặc meeting URL, contact/note.
- Offer phải lưu snapshot: position, workplace, wage, wage unit, expected schedule, proposed start date, expiry, note và trạng thái phản hồi.
- Không ghi đè snapshot offer khi Job bị sửa sau đó.

2. EMPLOYMENT — quan hệ nhân viên độc lập

Tạo model mới, tên phù hợp như `Employment` hoặc `EmployeeAssignment`, tối thiểu gồm:

- employerUserId
- employeeUserId
- sourceApplicationId
- jobId hoặc position/requisition ID phù hợp
- workplace/store reference nếu hệ thống có
- positionTitle
- status: `onboarding | active | suspended | terminated`
- startDate
- endDate
- terminationReasonCode và terminationNote
- wageRate, wageUnit, currency
- contractType/contractStatus ở mức MVP nếu phù hợp
- createdBy, activatedBy, terminatedBy
- history/audit timestamps

Ràng buộc:
- Chỉ Employment `active` (hoặc onboarding nếu policy cho phép) mới được xếp ca.
- Một ứng viên có thể có lịch sử nhiều employment; không suy ra nhân viên bằng cách lọc application.
- Kết thúc làm việc phải là soft transition `terminated`, không xóa Application và không làm mồ côi Shift.
- Trang “Nhân viên” phải đọc Employment, hiển thị trạng thái, vị trí, ngày bắt đầu và thao tác kết thúc làm việc.
- Khi chấm dứt, xử lý rõ các ca tương lai: liệt kê cho manager, cho chọn hủy hoặc phân công lại; không âm thầm xóa.

3. REQUISITION/CAPACITY — tách chỉ tiêu tuyển khỏi mẫu ca

Chuẩn hóa ý nghĩa:
- `headcountTarget`: tổng số người cần tuyển ban đầu.
- `hiredCount`: số employment được tạo từ đợt tuyển này.
- `remainingOpenings`: giá trị tính toán hoặc cập nhật nhất quán.
- `recruitmentStatus`: `open | paused | filled | closed`.
- Trạng thái tuyển dụng không quyết định vị trí/mẫu ca có còn hoạt động để xếp lịch hay không.

Nếu chưa phù hợp để tạo model Requisition riêng, có thể bổ sung các field này vào Job trong phase đầu, nhưng phải thiết kế để có thể tách sau.

Khi nhận người:
- Dùng MongoDB transaction/session nếu môi trường hỗ trợ.
- Kiểm tra lại capacity trong transaction.
- Chuyển application đúng state.
- Tạo Employment duy nhất cho application.
- Cập nhật hiredCount/remainingOpenings/recruitmentStatus.
- Chống double-click/retry bằng unique index và idempotency hợp lý.
- Nếu transaction không được môi trường dev hỗ trợ, tạo service boundary rõ ràng, test failure path và không để giảm capacity mà thiếu Employment.

4. SHIFT TEMPLATE/STAFFING REQUIREMENT — nhu cầu ca độc lập với chỉ tiêu tuyển

Không dùng `positions[].quantity` của tin tuyển dụng để sinh slot cho mọi ngày vô hạn.

Tạo hoặc chuẩn hóa cấu trúc mẫu ca, tối thiểu:
- employer/workplace
- position/role
- dayOfWeek hoặc recurrence rule đơn giản
- startTime, endTime
- requiredHeadcount
- effectiveFrom, effectiveTo
- active
- wage override nếu có

Màn hình ngày chỉ sinh các slot đúng weekday và khoảng hiệu lực. Việc đóng tuyển dụng không được làm mất mẫu ca.

5. SCHEDULING — lập và công bố lịch

State machine đề xuất:

`draft -> published -> acknowledged -> checked_in -> completed_pending_review -> approved -> payroll_ready -> paid`

Nhánh ngoại lệ:
- `cancelled`
- `no_show`
- `disputed`

Có thể giữ tên status hiện tại trong migration, nhưng API/UI mới phải có semantics rõ ràng.

Yêu cầu:
- Manager có thể tạo nhiều ca draft rồi publish theo ngày/tuần.
- Chỉ khi publish mới thông báo cho nhân viên.
- Nhân viên có thể acknowledge/xác nhận đã xem lịch.
- Mọi thay đổi ca đã publish phải lưu lịch sử và gửi thông báo.
- Duyệt công không đồng nghĩa đã trả tiền; `approved`, `payroll_ready`, `paid` là các trạng thái khác nhau.
- Không cho hard-delete ca đã published; dùng cancel kèm lý do.

6. KIỂM TRA ELIGIBILITY VÀ XUNG ĐỘT Ở SERVER

Áp dụng khi create, assign và reschedule:
- Employment thuộc đúng employer/workplace và còn active tại ngày ca.
- Nhân viên đủ điều kiện cho role/position.
- Không có shift không-cancelled giao nhau theo điều kiện `existing.start < new.end && existing.end > new.start`.
- Kiểm tra availability và time-off; policy cho phép manager override thì phải yêu cầu reason và ghi audit.
- Validate start/end, thời lượng tối đa, ca qua đêm và timezone `Asia/Ho_Chi_Minh`.
- Tính tổng giờ ngày/tuần và tạo cảnh báo hoặc block theo policy cấu hình.
- Không chỉ kiểm tra “cùng ngày”; ca qua nửa đêm cũng phải phát hiện xung đột.
- Thêm index phù hợp cho truy vấn employer/employee/time/status.

Ưu tiên lưu `startAt` và `endAt` là Date UTC, hiển thị theo `Asia/Ho_Chi_Minh`. Nếu cần giữ `date/startTime/endTime` cho tương thích, coi đó là field legacy hoặc derived và có migration/backfill.

7. AVAILABILITY, TIME OFF VÀ THAY ĐỔI CA

- Tích hợp Availability hiện có vào danh sách người có thể nhận ca.
- Hiển thị unavailable/conflict rõ ràng thay vì để API lỗi sau khi chọn.
- Bổ sung TimeOffRequest tối thiểu: pending/approved/rejected/cancelled, thời gian, lý do, actor/history.
- MVP đổi ca: nhân viên yêu cầu nhả ca hoặc đề nghị đổi với người đủ điều kiện; manager duyệt cuối cùng.
- Ca trống/open shift chỉ cho người đủ điều kiện và không xung đột nhận; thao tác nhận phải atomic.
- Nếu phạm vi quá lớn cho một lượt, hoàn thành Availability + TimeOff trước; triển khai swap/open shift ở phase riêng nhưng không để schema chặn khả năng mở rộng.

8. ATTENDANCE VÀ TIMESHEET

- Giữ cơ chế GPS/manual hiện có nhưng nối với state machine mới.
- Check-in/out chỉ dành cho đúng nhân viên được phân ca.
- Time window, GPS result, accuracy, distance và manual reason được server quyết định/lưu audit.
- Check-out tạo bản ghi/phase chờ duyệt công; manager có thể approve hoặc dispute.
- `workedMinutes` tính từ timestamp thực; hỗ trợ manager chỉnh có reason và lưu trước/sau.
- Không ghi trong history rằng đã chi trả nếu mới chỉ duyệt công.
- Thêm idempotency cho check-in, check-out, publish và approve để retry không tạo tác dụng phụ lặp.

PHASE TRIỂN KHAI

PHASE 0 — Khảo sát và kế hoạch thay đổi
- Đọc đầy đủ các model/routes/pages/services/tests liên quan.
- Dùng `rg` để tìm toàn bộ nơi đọc/ghi status legacy và `Job.slots`.
- Ghi ngắn gọn current flow, schema delta, migration order và rủi ro trước khi sửa.
- Kiểm tra MongoDB deployment có hỗ trợ transaction hay không; thiết kế fallback an toàn nếu không.

PHASE 1 — Domain model và migration
- Tạo Employment.
- Chuẩn hóa Application offer/status/history.
- Chuẩn hóa recruitment capacity.
- Tạo ShiftTemplate/StaffingRequirement và TimeOffRequest ở mức cần thiết.
- Chuẩn hóa Shift timestamps/status/audit.
- Viết migration idempotent cho dữ liệu cũ:
  - `pending -> submitted`
  - `reviewing -> screening`
  - `accepted/approved/hired` legacy phải được map cẩn thận.
  - Với application legacy đã hired, tạo Employment active nếu chưa có; không tạo trùng.
  - Backfill Shift startAt/endAt từ date/startTime/endTime theo Asia/Ho_Chi_Minh.
  - Không đoán dữ liệu không đủ chắc chắn; ghi migration warning/report để xử lý thủ công.
- Thêm unique/index cần thiết sau khi đã phát hiện và báo duplicate legacy.

PHASE 2 — Backend services và API
- Tách business logic khỏi route thành service/state transition functions có thể test.
- Endpoint employer: screening, interview, send/rescind offer.
- Endpoint student: accept/decline offer, withdraw đúng điều kiện.
- Transaction finalize hire tạo Employment và cập nhật capacity.
- API danh sách/detail/terminate Employment.
- API draft/publish/acknowledge shift.
- Conflict/eligibility/availability/time-off validation dùng chung cho create/reschedule/assign.
- Endpoint attendance/timesheet tương thích state machine mới.
- Authorization và ownership phải được cưỡng chế ở server.
- Chuẩn hóa lỗi với code ổn định để frontend xử lý, ví dụ `INVALID_TRANSITION`, `NO_OPENING`, `SHIFT_CONFLICT`, `OUTSIDE_AVAILABILITY`, `EMPLOYMENT_INACTIVE`.

PHASE 3 — Frontend
- Trang ứng viên hiển thị pipeline và chỉ các action hợp lệ theo status.
- Form lịch phỏng vấn có cấu trúc.
- Form gửi offer và màn hình ứng viên chấp nhận/từ chối.
- Trang nhân viên đọc Employment; thay “Xóa nhân viên” bằng “Kết thúc làm việc”.
- Trang xếp ca đọc Employment active, ShiftTemplate và Availability.
- Sửa sinh slot đúng weekday/effective range.
- Có chế độ lịch nháp và nút publish; hiển thị published/acknowledged rõ ràng.
- Hiển thị conflict trước khi submit nhưng vẫn để server xác nhận lần cuối.
- Không liệt kê người được tuyển cho job khác nếu họ không đủ eligibility; nếu hỗ trợ làm chéo vị trí, hiển thị rõ lý do đủ điều kiện.
- Tách “Duyệt công”, “Sẵn sàng tính lương”, “Đã trả”.
- Giữ loading/error/empty/toast và responsive hiện có.

PHASE 4 — Tests và làm sạch legacy

Viết test tối thiểu cho:

Application/offer:
- Không thể đi thẳng `submitted -> hired`.
- Employer khác không thể đổi trạng thái.
- Employer không thể accept offer thay ứng viên.
- Ứng viên khác không thể accept/decline.
- Offer hết hạn không thể accept.
- Accept lặp không tạo hai Employment hoặc giảm capacity hai lần.
- Reject/withdraw/decline không làm sai capacity.

Employment:
- Hired legacy migration không tạo trùng.
- Terminated employee không được nhận ca mới.
- Terminate không xóa Application/Shift/history.
- Xử lý ca tương lai đúng policy.

Capacity:
- Hai request hire cạnh tranh slot cuối chỉ có một request thành công.
- remainingOpenings/hiredCount nhất quán khi transaction fail.
- `filled` chỉ đóng nhận hồ sơ, không xóa scheduling template.

Scheduling:
- Template thứ Hai không sinh slot thứ Ba.
- Hai ca giao nhau bị 409 ở server.
- Ca chạm biên, ví dụ 08:00–12:00 và 12:00–16:00, được phép.
- Ca qua đêm phát hiện xung đột đúng.
- Reschedule cũng chạy conflict validation.
- Availability/time-off được kiểm tra.
- Draft không gửi notification; publish gửi đúng một lần; retry publish không gửi trùng.
- Ca published không bị hard-delete.

Attendance/pay:
- Không checkout trước check-in.
- Không approve trước checkout/completion.
- Approve không tự đánh dấu paid.
- Điều chỉnh thời gian công bắt buộc reason và có audit before/after.

Migration:
- Chạy hai lần không tạo dữ liệu trùng.
- Có dry-run/report count.
- Không xóa document cũ.

Sau khi mọi consumer đã chuyển sang schema mới và migration đã an toàn:
- Loại bỏ dần code ghi status `accepted/approved` của Application.
- Giữ compatibility read tạm thời nếu cần nhưng đánh dấu rõ TODO/retirement plan.
- Không để alias ID hoặc status legacy tiếp tục lan sang code mới.

TIÊU CHÍ NGHIỆM THU

1. Một application không còn được dùng như employee record.
2. Chỉ ứng viên mới có thể chấp nhận offer của chính họ.
3. Finalize hire tạo đúng một Employment và cập nhật capacity nhất quán.
4. Nghỉ việc không xóa lịch sử tuyển dụng, ca làm hay bảng công.
5. Job tuyển đủ vẫn có thể tiếp tục dùng mẫu ca để xếp lịch.
6. Slot chỉ xuất hiện đúng ngày trong lịch mẫu.
7. Backend chặn xếp trùng ca và nhân viên không đủ điều kiện.
8. Availability/time-off được dùng trong xếp ca.
9. Lịch nháp không thông báo; publish mới thông báo; nhân viên có thể acknowledge.
10. Duyệt công và trả lương là hai trạng thái độc lập.
11. Các migration chạy lặp an toàn và có dry-run.
12. Test, lint và production build pass; không làm hỏng các test hiện có.

DELIVERABLE CUỐI

- Code backend và frontend hoàn chỉnh.
- Migration scripts và lệnh chạy dry-run/apply.
- Test mới cho các invariant quan trọng.
- Cập nhật README hoặc tài liệu riêng về state machines, migration và quy trình nghiệp vụ.
- Báo cáo cuối gồm:
  - Các file đã thay đổi.
  - Schema/index mới.
  - Mapping legacy và kết quả migration dry-run.
  - API contract/action mới hoặc thay đổi.
  - Test/lint/build đã chạy và kết quả.
  - Những phần chưa hoàn thành, nếu có, kèm blocker cụ thể.

Không dừng ở việc phân tích. Hãy triển khai lần lượt theo phase, kiểm tra sau mỗi phase và tiếp tục cho đến khi đạt acceptance criteria hoặc gặp blocker thật sự cần quyết định của người dùng.
```
