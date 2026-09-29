# Prompt cho Antigravity Code — chuẩn hóa luồng quản lý lịch làm

Bạn đang làm việc trực tiếp trong repository **Hoa Lac Viec**, nền tảng việc làm theo ca dành cho sinh viên và cửa hàng tại khu vực Hòa Lạc.

## Nhiệm vụ

Hãy **audit và sửa code thật** cho toàn bộ luồng quản lý lịch làm, từ lập lịch, công bố, nhân viên phản hồi, thay đổi lịch, xin nghỉ, chấm công, duyệt công đến thanh toán.

Không chỉ sửa UI và không chỉ viết báo cáo. Hãy sửa domain model, authorization, API, frontend, migration/backward compatibility và test theo một workflow nhất quán. Ưu tiên tính đúng đắn, quyền truy cập và audit trail trước các tính năng tiện ích.

## Căn cứ tham khảo sản phẩm

Đã đối chiếu với các luồng chính thức sau. Dùng chúng làm benchmark về workflow, không sao chép giao diện:

- [Microsoft Shifts — schedule staff shifts](https://support.microsoft.com/en-us/teams/shifts/schedule-staff-shifts): quản lý tạo lịch ở trạng thái chưa công bố, publish theo khoảng thời gian, chỉ sau publish nhân viên mới thấy lịch; lịch mở có thể tồn tại trước khi gán người.
- [Microsoft Shifts — open shifts, swap và offer](https://support.microsoft.com/en-us/teams/shifts/request-open-shifts-swap-or-offer-shifts-in-shifts): request có trạng thái theo dõi rõ ràng; swap cần đồng nghiệp chấp nhận rồi quản lý duyệt; open shift và offer shift đều có approval flow.
- [Microsoft Shifts — quản lý requests/time off](https://support.microsoft.com/en-us/teams/shifts/manage-shift-requests-and-time-off-in-shifts): request đang xử lý và đã xử lý được tách riêng; approve/reject cập nhật lịch và thông báo cho nhân viên.
- [When I Work — scheduling a shift](https://help.wheniwork.com/articles/scheduling-a-shift/): phân biệt Save và Save & Publish; hiển thị availability, time off, xung đột/max hours khi chọn người; hỗ trợ open shift, template và break.
- [When I Work — getting shifts covered](https://help.wheniwork.com/articles/getting-your-shifts-covered/): phân biệt release/drop/swap và có thể yêu cầu manager review.
- [Sling — available shifts](https://support.getsling.com/en/articles/1078483-available-shifts): tách unassigned, available và unpublished; thay đổi một ca đã công bố cần publish lại để nhân viên thấy bản mới.
- [Deputy — scheduling basics](https://help.deputy.com/hc/en-au/sections/4614433180431-Scheduling-Basics): confirmation, swap/offer, availability và break là các capability riêng, không nên trộn vào một status.
- [ILO/MOLISA — Working hours and rest periods, Labour Code 2019](https://www.ilo.org/publications/labour-code-2019-working-hours-and-rest-periods): cần có kiểm tra/cảnh báo về giờ làm, nghỉ giữa giờ, nghỉ chuyển ca và giờ làm ban đêm. Đây là compliance guard; không tuyên bố sản phẩm đã “tuân thủ pháp luật” nếu chưa được chuyên gia pháp lý xác nhận.

## Code cần đọc trước khi sửa

### Backend

- `server/src/models/Shift.js`
- `server/src/models/ShiftTemplate.js`
- `server/src/models/TimeOffRequest.js`
- `server/src/models/Availability.js`
- `server/src/models/Employment.js`
- `server/src/services/schedulingService.js`
- `server/src/routes/shiftRoutes.js`
- `server/src/routes/shiftTemplateRoutes.js`
- `server/src/routes/timeOffRoutes.js`
- `server/src/services/employmentService.js`
- `server/src/utils/geoHelper.js`
- `server/src/utils/taskContract.js`
- toàn bộ test liên quan `Shift`, attendance, employment, time off và authorization.

### Frontend

- `client/src/pages/employer/EmployerShiftsPage.jsx`
- `client/src/pages/student/ShiftsPage.jsx`
- `client/src/pages/student/ProfilePage.jsx` (availability)
- `client/src/pages/employer/EmployerEmployeesPage.jsx`
- `client/src/pages/student/DashboardPage.jsx`
- `client/src/pages/employer/EmployerDashboardPage.jsx`
- `client/src/services/api.js`
- `client/src/services/index.js`
- `client/src/constants/index.js`
- `client/src/components/Badge.jsx`
- `client/src/components/NotificationDropdown.jsx`

Đọc `git status` và diff trước. `client/src/pages/employer/EmployerShiftsPage.jsx` có thể đang có thay đổi chưa commit của người dùng; phải bảo toàn ý định của thay đổi đó, không overwrite hoặc reset.

## Audit hiện trạng đã xác định

### A. Lỗi domain/state machine

1. `Shift.status` đang gánh ba lifecycle khác nhau:
   - lịch: `draft`, `published`, `acknowledged`, `cancelled`;
   - attendance/timesheet: `checked_in`, `completed_pending_review`, `approved`, `disputed`, `no_show`;
   - payroll: `payroll_ready`, `paid`.

   Vì vậy UI và backend phải so sánh một danh sách status rất dài, có legacy alias ở nhiều nơi và dễ cho phép transition sai.

2. Model vẫn chứa `scheduled`, `needs_review`, `pending_approval`, `completed`, `absent` để tương thích nhưng constants phía client chỉ biết bộ status cũ. Label/status logic bị nhân bản ở nhiều component.

3. Không có một transition map duy nhất được server enforce. Mỗi service tự kiểm tra một danh sách khác nhau.

4. `disputed` là trạng thái ngõ cụt: có thể tạo dispute nhưng không có luồng resolve, accept adjustment, reject dispute hoặc quay lại review/approved.

5. Reschedule:
   - vẫn có thể áp dụng cho một số trạng thái đáng lẽ bị khóa như `completed_pending_review`, `payroll_ready`, `disputed`, `cancelled`, `no_show`;
   - không tính lại `hours` và planned pay;
   - không reset acknowledgement/revision khi lịch đã công bố thay đổi;
   - không bắt reason cho thay đổi đã publish.

6. Cancel chỉ chặn `approved` và `paid`, nên hiện có thể hủy một ca đang check-in, đã check-out/chờ duyệt, đang tranh chấp hoặc payroll-ready.

7. Draft được kiểm tra conflict lúc tạo nhưng publish không preflight lại. Trong thời gian draft, availability/time off/employment hoặc lịch khác có thể thay đổi.

### B. Lỗ hổng authorization và data integrity — ưu tiên P0

1. Các action `approve`, `payroll-ready`, `pay`, `adjust`, `dispute`, `cancel` và delete cần kiểm tra role + ownership nhất quán ở server. Không được tin UI. Hiện nhiều service chỉ nhận `actorUserId` để ghi history nhưng không xác minh actor có sở hữu ca.

2. Endpoint dispute hiện thiếu ownership, role, required reason và valid-source-status checks.

3. `PUT /time-off/:id/status` chỉ kiểm tra ownership khi actor là employer; một authenticated user không phải employer có khả năng đi qua nhánh này. Cần permission matrix rõ ràng:
   - employee chỉ được cancel request của chính mình khi còn `pending`;
   - đúng employer sở hữu employment mới được approve/reject;
   - admin theo policy cụ thể;
   - không ai được tùy ý chuyển request terminal sang status khác.

4. Tạo time-off hiện vẫn tạo request nếu không tìm thấy active/onboarding employment và có thể gửi tới một employer ID tùy ý. Phải require employment hợp lệ và derive employer/employment authoritative từ server.

5. Template route phải xác thực `jobId` thuộc employer, thời gian hợp lệ và effective range hợp lệ.

6. Mọi mutation phải validate ObjectId, payload type/range, source state và actor permission; trả error code ổn định.

7. Mutation nhạy cảm phải idempotent hoặc dùng atomic conditional update/version check để double-click/concurrent requests không tạo transition kép.

### C. Luồng lập lịch chưa nối với nhau

1. Backend đã có ShiftTemplate và TimeOffRequest nhưng `EmployerShiftsPage` không sử dụng các API này; student cũng chưa có UX hoàn chỉnh để tạo/theo dõi/hủy đơn nghỉ.

2. Availability của student chỉ là các bucket `morning/afternoon/evening` trong profile và chưa tham gia server-side scheduling validation.

3. Employer UI đang suy ra nhu cầu ca mỗi ngày từ `Job.positions`, `Job.schedule` và số lượng tuyển dụng. Đây là recruitment data, không phải schedule demand. Không được coi số vị trí tuyển dụng là slot bắt buộc lặp mỗi ngày.

4. UI ghép shift DB vào slot bằng heuristic `roleMatch || timeMatch`, rồi fallback chỉ theo `jobId`. Cách này có thể gắn một ca vào sai slot. Liên kết phải dựa trên ID/domain record rõ ràng.

5. ShiftTemplate chưa thực sự sinh schedule occurrence; chưa có thao tác copy tuần, apply template theo khoảng ngày hoặc coverage count đáng tin cậy.

6. Hệ thống chỉ hỗ trợ assigned shift. Chưa có khái niệm open/unassigned shift và request-to-pick-up có approval.

### D. Luồng nhân viên và attendance

1. `acknowledged` hiện có nghĩa “đã xem”, nhưng bị dùng như một phase của ca. Receipt/acknowledgement nên là metadata của schedule revision, không phải thay thế lifecycle chính.

2. Nếu sản phẩm cần nhân viên đồng ý lịch, phải tách rõ:
   - `seen/acknowledged`: đã nhận thông báo;
   - `accepted/declined`: cam kết nhận hoặc báo không thể làm.
   Không gọi nút “xác nhận đã xem” là chấp nhận ca.

3. Student page hiển thị tất cả shift theo grid, chưa ưu tiên “ca đang diễn ra”, “ca sắp tới”, “cần phản hồi”, “lịch sử”. Backend hiện sort date giảm dần nên lịch cũ có thể đứng trước lịch sắp tới.

4. Client vẫn mở nút check-in cho published/acknowledged mà không hiển thị trước cửa sổ hợp lệ; server mới báo lỗi sau click.

5. Manual/GPS `needs_review` đang bị nhồi vào shift status/attendance fields không nhất quán. Check-in provisional, verification và timesheet approval cần phân biệt.

6. Checkout chưa có guard rõ cho checkout quá sớm/quá muộn, missed checkout, manager clock-out/correction và break.

7. `no_show` có trong model nhưng không có flow đánh dấu/giải trình/resolve rõ ràng.

8. Tiền ca dự kiến và tiền thực tế cần tách. Không ghi đè planned amount bằng calculated timesheet amount mà không giữ snapshot/audit.

### E. Compliance và scheduling concerns

Hiện conflict check mới chỉ chặn overlap và approved time off. Cần có policy engine trả về `errors` và `warnings`, tối thiểu:

- overlap tuyệt đối;
- approved time off;
- pending time off (warning);
- availability mismatch (warning hoặc error theo setting);
- employment không active;
- khoảng nghỉ giữa hai ca;
- tổng giờ theo ngày/tuần;
- ca ban đêm;
- break bắt buộc cho ca dài;
- overtime/max-hours nếu cấu hình;
- ca qua đêm;
- địa điểm khác nhau với travel buffer nếu dữ liệu đủ.

Theo tài liệu ILO/MOLISA tóm tắt Bộ luật Lao động 2019: giờ bình thường không quá 8 giờ/ngày và 48 giờ/tuần; giờ đêm 22:00–06:00; ca từ 6 giờ cần nghỉ giữa giờ tối thiểu 30 phút, ca đêm 45 phút; nghỉ chuyển ca tối thiểu 12 giờ; nghỉ hằng tuần tối thiểu 24 giờ liên tục. Hãy triển khai các giá trị thành policy có cấu hình và test, không hard-code rải rác. Với loại quan hệ không phải hợp đồng lao động hoặc trường hợp ngoại lệ, UI phải ghi là cảnh báo cần kiểm tra, không tự đưa ra kết luận pháp lý.

## Kiến trúc đích

### 1. Tách lifecycle

Không tiếp tục dùng một chuỗi `status` làm source of truth cho mọi thứ. Thiết kế canonical fields tối thiểu:

```text
scheduleStatus: draft | published | cancelled
assignmentStatus: assigned | acknowledged | accepted | declined
attendanceStatus: not_started | checked_in | checked_out | needs_review | approved | disputed | no_show
payrollStatus: not_ready | ready | paid
```

Điều chỉnh tên nếu domain hiện tại cần, nhưng phải giữ ba nguyên tắc:

- schedule, attendance và payroll là các state machine độc lập;
- action availability được derive từ state + actor + time, không hard-code rải trong JSX;
- legacy `status` chỉ là compatibility projection trong giai đoạn migration, không tiếp tục là nơi ghi chính.

Tạo module domain dùng chung ở backend, ví dụ:

- enum/constants;
- transition maps;
- `assertCanTransition(...)`;
- `getAllowedShiftActions(shift, actor, now)` hoặc DTO tương đương;
- mapper legacy → canonical;
- display status derivation cho client.

Không import code backend thẳng vào frontend. Frontend có constants/DTO contract đồng bộ và server nên trả `allowedActions` để UI không tự đoán quyền.

### 2. Schedule revision và publish

Mỗi thay đổi lịch đã publish phải có:

- `scheduleRevision` tăng dần;
- snapshot trước/sau hoặc history event có structured data, không chỉ note string;
- `publishedAt`, `publishedBy`;
- `acknowledgedRevision`, `acknowledgedAt`;
- reason bắt buộc nếu sửa/hủy ca đã publish;
- notify đúng người bị ảnh hưởng sau khi transaction thành công.

Khi reschedule ca đã publish: tăng revision, reset acknowledgement/acceptance cho revision mới và yêu cầu nhân viên phản hồi lại. Draft edit không gửi notification.

Publish theo khoảng ngày/tuần hoặc selected IDs, có preflight summary:

- số ca hợp lệ;
- số error bắt buộc sửa;
- số warning cần xác nhận;
- danh sách nhân viên bị ảnh hưởng.

Không publish im lặng một phần nếu UI hiểu là atomic. Hoặc thực hiện transaction all-or-nothing, hoặc API phải trả kết quả từng item và UI thể hiện partial result rõ ràng.

### 3. Planning source đúng domain

- Không generate daily staffing slots trực tiếp từ `Job.positions.quantity`.
- Dùng `ShiftTemplate`/schedule requirement hoặc một `ScheduleSlot/OpenShift` record làm nguồn nhu cầu.
- Template phải apply vào date range để tạo draft occurrences; template edit không âm thầm sửa các ca đã publish.
- Mỗi occurrence/slot có ID rõ ràng. Assignment liên kết bằng `slotId/templateId`, không fuzzy-match role/time.
- Hỗ trợ unassigned/open shift ở phase sau khi nền tảng P0/P1 ổn định.

### 4. Time off và availability

- Time off có lifecycle server-enforced: `pending → approved|rejected|cancelled`; terminal không reopen tùy tiện.
- Employee được xem, tạo và hủy pending request của chính mình.
- Employer thấy inbox pending, conflict impact và approve/reject kèm note.
- Khi approve time off chồng ca đã publish, không để hai bản ghi mâu thuẫn. Transaction phải yêu cầu manager chọn một hành động rõ: giữ ca và cảnh báo, unassign/open ca, hoặc cancel/reschedule ca; ghi audit và notify.
- Availability cần biểu diễn time ranges/effective dates thay vì chỉ bucket mơ hồ nếu dùng để validate chính xác. Có thể migrate bucket cũ thành preference ban đầu.
- Availability là preference theo mặc định; approved time off là hard block.

### 5. Attendance và timesheet

- Dùng server time làm authoritative `checkInAt/checkOutAt`; client timestamp chỉ là evidence metadata.
- GPS verification state độc lập với attendance state.
- Check-in manual/GPS yếu có thể tạo provisional attendance `needs_review`, không được tự coi là đã verified.
- Định nghĩa window check-in, late arrival, early checkout, missed checkout và manager correction bằng policy có cấu hình.
- Break có planned/actual minutes; tiền công tính từ approved payable minutes theo wage snapshot.
- Adjustment yêu cầu before/after, reason, actor và timestamp; không cho sửa sau paid nếu không có reversal flow.
- Duyệt công chỉ do employer sở hữu/admin đúng policy; disputed phải có resolve action rõ ràng.

### 6. Payroll

- Giữ payroll tách khỏi attendance approval.
- `approved → ready → paid` là payroll flow; không cho reschedule/cancel/adjust thông thường sau khi ready/paid.
- Lưu `rateSnapshot`, `plannedMinutes`, `approvedMinutes`, `grossPay`, `paidAt`, `paidBy` và optional payment reference/note.
- Nếu scope chưa có payroll batch, vẫn giữ per-shift flow nhưng thiết kế API để sau này gom theo pay period được.

## Permission matrix bắt buộc

| Action | Employee được phân ca | Employer sở hữu | Admin |
|---|---:|---:|---:|
| Xem ca | Có | Có | Theo policy |
| Tạo/edit draft | Không | Có | Theo policy |
| Publish | Không | Có | Theo policy |
| Acknowledge/accept/decline | Có, ca của mình | Không | Không giả danh |
| Reschedule/cancel published | Không; dùng request | Có, trước attendance lock | Theo policy |
| Check-in/out | Có, ca của mình | Chỉ correction flow | Theo policy có audit |
| Approve/adjust timesheet | Không | Có | Theo policy |
| Dispute | Có với ca của mình; employer sở hữu | Có | Theo policy |
| Resolve dispute | Chấp nhận/ phản hồi theo flow | Có | Theo policy |
| Mark payroll ready/paid | Không | Có | Theo policy |
| Time-off request | Có, employment của mình | Không | Không giả danh |
| Approve/reject time off | Không | Có, employment của mình | Theo policy |

Mỗi hàng phải có integration test negative: actor khác employer/student không được mutate resource dù biết ID.

## Luồng chuẩn cần triển khai

### Employer

1. Chọn tuần → thấy coverage theo employee/slot và các cảnh báo.
2. Tạo ca nháp từ template, copy tuần hoặc ca đơn lẻ.
3. Gán nhân viên hoặc để open/unassigned.
4. Preflight conflict/availability/time-off/rest/hours.
5. Publish một khoảng lịch → notify người bị ảnh hưởng.
6. Theo dõi chưa xem/chưa phản hồi/declined và xử lý coverage.
7. Ngày làm: theo dõi attendance exception, không trộn vào editing mode.
8. Sau ca: review timesheet exceptions → adjust/dispute resolution → approve.
9. Chuyển payroll ready → paid có audit.

### Employee/student

1. Mặc định thấy ca kế tiếp và việc cần làm, không phải lịch sử cũ.
2. Tab/section: `Cần phản hồi`, `Sắp tới`, `Đang diễn ra`, `Chờ duyệt công`, `Lịch sử`.
3. Acknowledge/accept hoặc decline có reason theo policy.
4. Tạo và theo dõi time-off; hủy request khi pending.
5. Có thể request open shift/coverage ở phase 2.
6. Check-in chỉ bật trong window; trước đó UI hiển thị khi nào có thể check-in.
7. Check-out, xem actual time/GPS evidence và trạng thái duyệt.
8. Mở dispute có reason/evidence; theo dõi đến khi resolved.

## Phạm vi theo phase

### Phase P0 — bắt buộc hoàn thành trước

- Vá toàn bộ role/ownership/IDOR ở shift, timesheet, payroll, dispute, cancel/delete và time-off.
- Tạo canonical transition/permission module và server-enforced guards.
- Chặn transition bất hợp lệ, double submit và mutation sau terminal state.
- Sửa reschedule recompute duration/pay estimate, revision và re-acknowledgement.
- Hoàn thiện dispute resolution tối thiểu.
- Thêm integration tests cho authorization và state transitions.

### Phase P1 — core scheduling đúng chuẩn

- Tách canonical schedule/attendance/payroll states với migration/backward compatibility.
- Nối ShiftTemplate, availability và TimeOff vào scheduler.
- Bỏ việc derive staffing slots từ recruitment quantity và fuzzy matching.
- Week view + publish range + preflight + employee response.
- Student upcoming/action/history views.
- Attendance/timesheet exception workflow.

### Phase P2 — workforce self-service

- Open/unassigned shifts và pickup request.
- Offer/release/swap flow có coworker response + manager approval.
- Reminder/escalation, missed check-in/out và no-show resolution.
- Copy week/bulk edit an toàn.

Không làm P2 trước khi P0/P1 ổn định.

## API và data migration

- Không phá dữ liệu cũ. Viết migration idempotent từ legacy `status` sang canonical fields.
- Tạm thời trả `status` derived để client cũ không vỡ, nhưng code mới không mutate legacy status trực tiếp.
- Version API response nếu cần; document request/response/error codes.
- Mọi date-time authoritative dùng UTC `Date`; display theo `Asia/Ho_Chi_Minh`. Date-only phải parse rõ ràng, không phụ thuộc timezone máy chạy.
- Validate nghiêm `YYYY-MM-DD`, `HH:mm`, overnight semantics và maximum duration.
- Dùng Mongo transaction cho multi-record operations như approve time-off + xử lý ca chồng, swap hoặc publish batch nếu deployment hỗ trợ; nếu không, thiết kế compensating/idempotent workflow và test failure paths.
- Notification chỉ gửi sau mutation thành công; tránh notification trùng khi retry.

## UI/UX cần sửa

- Employer mặc định là week schedule/coverage view; “Duyệt công” và “Payroll” là queue/tab riêng, không nhét mọi action vào từng slot lịch.
- Student ưu tiên một “next shift” actionable; lịch sử tách riêng.
- Badge hiển thị derived display status, không show ba status ngang hàng trừ detail view.
- Chỉ render action server trả trong `allowedActions` và vẫn xử lý 403/409 an toàn.
- Khi xung đột, hiển thị record gây xung đột, severity và cách xử lý; không chỉ toast chung chung.
- Publish/reschedule/cancel/payment là hành động quan trọng: confirmation phải nêu phạm vi, người bị ảnh hưởng và hậu quả.
- Không dùng emoji làm status icon; dùng Lucide và text rõ ràng.
- Giữ accessibility, keyboard, mobile và encoding tiếng Việt.

## Test bắt buộc

Viết unit/integration tests thực chất, không chỉ kiểm tra mảng hard-code trong test:

1. Mọi valid và invalid transition của ba state machine.
2. Cross-employer IDOR cho từng mutation.
3. Student không thao tác ca/time-off của người khác.
4. Time-off approve chồng ca và rollback/failure path.
5. Draft hợp lệ lúc tạo nhưng conflict lúc publish.
6. Published reschedule tăng revision, reset acknowledgement và notify một lần.
7. Overnight shift có exact expected UTC timestamp; bỏ assertion tự so sánh vô nghĩa.
8. Overlap, abutting, minimum rest, daily/weekly hours, night shift và break rules.
9. Duplicate check-in/out và concurrent publish/payment.
10. Manual GPS review, adjustment audit, dispute → resolve.
11. Không adjust/cancel/reschedule ca đã paid.
12. Legacy migration chạy hai lần không thay đổi kết quả lần hai.
13. Frontend action visibility theo `allowedActions`, loading/error/409 state.

Sau khi sửa, chạy ít nhất:

```bash
cd server && npm test
cd client && npm run lint && npm run build
```

Nếu lint hiện có lỗi baseline không liên quan, ghi rõ baseline và lỗi mới; không che giấu.

## Tiêu chí nghiệm thu

- Không còn endpoint shift/time-off có thể mutate resource khác tenant/owner.
- Có một nguồn duy nhất cho transition và permission rules ở server.
- Schedule, attendance và payroll không còn bị trộn trong một mutable status.
- Published schedule thay đổi có revision, reason, re-acknowledgement và audit.
- Availability, time off, conflict và rest rules xuất hiện trong preflight.
- Recruitment slots không còn được dùng làm staffing schedule source.
- Employer có planning/publish, attendance review và payroll queue tách bạch.
- Student thấy next/actionable shifts trước, có request/response/history rõ ràng.
- Dispute và no-show không còn là state ngõ cụt.
- Legacy data vẫn đọc được và migration idempotent.
- Test backend, lint/build frontend pass; không mất chức năng GPS/location hiện có.

## Kết quả cần báo cáo

Khi hoàn tất, trả lời bằng tiếng Việt, ngắn gọn nhưng có bằng chứng:

1. Root causes đã sửa.
2. State machines và permission matrix cuối cùng.
3. Migration/backward compatibility đã làm.
4. Các file chính đã thay đổi.
5. Test/lint/build đã chạy và kết quả.
6. Hạng mục nào chủ động để lại P2.
7. Bất kỳ giả định pháp lý/nghiệp vụ nào cần product owner xác nhận.

Không dừng ở kế hoạch. Bắt đầu bằng audit diff hiện tại, khóa P0, viết test failing cho authorization/transition, rồi mới triển khai.
