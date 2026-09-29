# Prompt cho Antigravity — Sửa luồng lịch làm, xếp ca và chấm công

```text
Bạn là senior full-stack engineer. Hãy kiểm tra và sửa code trực tiếp trong repository hiện tại của dự án Hoa Lạc Việc theo đúng nghiệp vụ dưới đây. Đây là nhiệm vụ triển khai hoàn chỉnh, không chỉ viết kế hoạch, mô tả giải pháp hoặc làm mock UI.

Stack hiện tại:
- Frontend: React + Vite + Tailwind.
- Backend: Node.js + Express + Mongoose/MongoDB.
- Người lao động gồm các role: `student`, `worker`, `freelancer`.
- Nhà tuyển dụng có role: `employer`.

## Nghiệp vụ bắt buộc

1. Sinh viên/lao động tự do chỉ được XEM lịch làm đã được nhà tuyển dụng công bố và được phân cho chính mình.
2. Sinh viên/lao động tự do không có quyền tự điểm danh, check-in hoặc check-out.
3. Nhà tuyển dụng là bên xếp ca và chấm công cho nhân viên của mình.
4. Xếp ca không phụ thuộc vào tin tuyển dụng (`Job`). Tin tuyển dụng chỉ dùng để thu hút và tuyển ứng viên. Sau khi ứng viên đã trở thành nhân viên (`Employment`), lịch làm phải hoạt động độc lập với bài đăng, kể cả khi bài đăng đã đóng, tạm dừng, hết hạn hoặc được lưu trữ.
5. Khi thêm ca, nhà tuyển dụng chọn nhân viên đang làm việc từ `Employment`, sau đó nhập ngày, giờ bắt đầu, giờ kết thúc và các thông tin cần thiết của ca. Không bắt chọn “Cơ sở / Bài đăng công việc” và không lọc lịch theo bài đăng.
6. Hệ thống hiện chỉ có một `EmployerProfile` cho mỗi employer. Không tạo thêm module nhiều chi nhánh/cơ sở trong nhiệm vụ này. Có thể dùng `Employment.workplace` hoặc `EmployerProfile.storeName` làm dữ liệu hiển thị/snapshot, nhưng không dùng chúng làm khóa nghiệp vụ hoặc điều kiện bắt buộc để tạo ca.

Các quy tắc trên là nguồn sự thật. Nếu code hiện tại hoặc test cũ mâu thuẫn với chúng thì phải sửa code và cập nhật test theo nghiệp vụ mới.

## Phạm vi cần kiểm tra

Đọc code thực tế trước khi sửa, tối thiểu gồm:
- `server/src/models/Shift.js`
- `server/src/models/ShiftTemplate.js`
- `server/src/models/Employment.js`
- `server/src/models/EmployerProfile.js`
- `server/src/routes/shiftRoutes.js`
- `server/src/routes/shiftTemplateRoutes.js`
- `server/src/routes/employmentRoutes.js`
- `server/src/services/schedulingService.js`
- `server/src/domain/shiftLifecycle.js`
- `client/src/pages/student/ShiftsPage.jsx`
- `client/src/pages/employer/EmployerShiftsPage.jsx`
- `client/src/services/api.js`
- Các test liên quan tới shift, employment, authorization và lifecycle.

Kiểm tra worktree trước khi sửa và bảo toàn mọi thay đổi có sẵn của người dùng.

## 1. Quyền của sinh viên/lao động tự do

Áp dụng đồng nhất cho cả ba role: `student`, `worker`, `freelancer`.

Họ chỉ được:
- Xem danh sách ca đã công bố hoặc đã hủy được phân cho chính mình.
- Xem chi tiết ngày, giờ, vị trí công việc, nơi làm việc nếu có, trạng thái lịch và kết quả chấm công do nhà tuyển dụng ghi nhận.
- Không được thấy ca nháp.
- Không được thấy ca của người khác.

Họ không được:
- Tạo, sửa, dời, hủy, công bố hoặc phân công ca.
- Tự điểm danh, check-in hoặc check-out bằng GPS hay thủ công.
- Tự thay đổi `attendanceStatus`, giờ bắt đầu thực tế, giờ kết thúc thực tế hoặc số phút làm việc.
- Gọi trực tiếp bất kỳ API mutation nào để thay đổi ca hoặc dữ liệu chấm công.

Yêu cầu bắt buộc:
- Backend phải cưỡng chế quyền, không chỉ ẩn nút ở frontend.
- Nếu `student`, `worker` hoặc `freelancer` gọi endpoint check-in/check-out hay endpoint chấm công thì trả `403` với code `FORBIDDEN`.
- API lấy danh sách ca phải tự ép filter theo user đang đăng nhập; bỏ qua mọi query cố tình truyền ID của người khác.
- Sửa `getAllowedShiftActions` để không trả action chấm công cho người lao động.

### Giao diện `/student/shifts`

- Đổi thành màn hình lịch làm chỉ đọc.
- Đổi tiêu đề “Lịch làm việc & Điểm danh” thành “Lịch làm việc”.
- Bỏ mô tả nói người lao động tự điểm danh bằng GPS.
- Xóa nút/modal/logic lấy vị trí GPS, check-in, check-out và điểm danh thủ công.
- Không gọi API check-in/check-out từ trang này.
- Vẫn hiển thị lịch sắp tới, lịch sử ca và trạng thái chấm công dưới dạng thông tin.
- Dùng wording “nhân viên” hoặc “người lao động” trong domain lịch làm, không giả định mọi người đều là sinh viên.
- Giữ loading, error, empty state và responsive hiện có.

Không tự ý sửa các module khác ngoài phần cần thiết cho lịch làm và chấm công.

## 2. Nhà tuyển dụng xếp ca

Nhà tuyển dụng chỉ được thao tác trên Employment và Shift thuộc chính mình.

### Luồng “Thêm ca làm” mới

Form thêm ca của employer phải gồm tối thiểu:
- Nhân viên: chọn từ `Employment` có `employerUserId` là employer hiện tại và `status = active`.
- Ngày làm, giờ bắt đầu, giờ kết thúc.
- Vị trí/vai trò: mặc định từ `Employment.positionTitle`.
- Mức lương: mặc định từ `Employment.wageRate` nếu ca lưu wage snapshot.
- Trạng thái nháp hoặc công bố theo cơ chế hiện có.

Không được có:
- Selector “Cơ sở / Bài đăng công việc”.
- Yêu cầu bắt buộc `jobId`.
- Filter lịch theo `jobId`.
- Logic chỉ cho tạo ca khi Job đang mở.

Dropdown nhân viên:
- Đọc từ `Employment`, không đọc từ `Job`, `Application` hoặc danh sách ứng viên.
- Chỉ hiển thị Employment active của employer hiện tại.
- Không hiển thị người đã `terminated`, `suspended` hoặc thuộc employer khác.
- Hiển thị tên nhân viên và vị trí công việc để dễ chọn.

### Trang `/employer/shifts`

- CTA chính là “Thêm ca làm”.
- Bỏ filter “Tất cả bài đăng / cơ sở” và mọi filter theo Job.
- Có thể lọc theo tuần/khoảng ngày, nhân viên và trạng thái ca.
- Hiển thị workplace dưới dạng text nếu có, không dùng workplace để quyết định quyền hoặc khả năng tạo ca.
- Lịch vẫn hoạt động nếu Job nguồn đã đóng, tạm dừng, hết hạn hoặc lưu trữ.

## 3. Nhà tuyển dụng chấm công

Chỉ employer sở hữu ca, hoặc admin theo quyền quản trị hiện có, được ghi nhận chấm công.

Employer cần có các thao tác phù hợp với state hiện tại:
- “Ghi nhận vào ca” hoặc “Có mặt”: lưu thời điểm bắt đầu thực tế.
- “Kết thúc ca”: lưu thời điểm kết thúc thực tế và tính `workedMinutes` tại server.
- “Vắng mặt”: chuyển attendance sang `no_show` với ghi chú/lý do nếu cần.
- Điều chỉnh giờ công: bắt buộc có lý do và ghi audit trước/sau.
- Duyệt công theo luồng hiện có sau khi ca kết thúc.

Yêu cầu:
- Không yêu cầu GPS của thiết bị nhân viên.
- Employer có thể nhập thời gian thực tế khi ghi nhận muộn, nhưng server phải validate thời gian hợp lệ.
- Kết thúc ca không được trước lúc bắt đầu ca.
- Mọi thay đổi phải ghi `changedBy`, timestamp, trạng thái và note/reason vào history.
- Chống thao tác lặp gây nhân đôi history hoặc tác dụng phụ.
- Employer A không thể chấm công ca của Employer B.
- Không cho thay đổi attendance/timesheet của ca đã bị khóa thanh toán theo policy hiện có.

Có thể giữ route `/checkin` và `/checkout` để giảm thay đổi tương thích, nhưng phải đổi authorization để chỉ employer sở hữu ca/admin được gọi. Nếu tạo endpoint mới rõ nghĩa hơn, giữ compatibility an toàn và tuyệt đối không để người lao động dùng route cũ để chấm công.

## 4. Tách Shift khỏi Job

Ca mới phải dựa vào:
- `employerUserId`.
- `employmentId`.
- User nhân viên lấy từ `Employment.employeeUserId`.
- `startAt`, `endAt`.
- Snapshot cần thiết như tên nhân viên, vị trí, workplace và wage.

`jobId`:
- Không còn bắt buộc khi tạo ca.
- Không dùng để authorize ca hoặc quyết định employer.
- Không quyết định ca có được tạo, công bố hoặc chấm công hay không.
- Có thể giữ nullable cho dữ liệu legacy và truy vết nguồn tuyển dụng.

`Employment.jobId` có thể tiếp tục tồn tại để biết nhân viên được tuyển từ bài đăng nào, nhưng không được là dependency của lịch làm sau khi Employment được tạo.

Khi tạo ca từ `employmentId`, server phải:
1. Tìm Employment.
2. Xác minh Employment thuộc employer đăng nhập.
3. Xác minh Employment đang active tại thời điểm ca.
4. Lấy employee, position, workplace và wage từ Employment.
5. Lấy `EmployerProfile.storeName` làm fallback hiển thị nếu `Employment.workplace` trống.
6. Kiểm tra xung đột với ca chưa hủy của cùng nhân viên, bao gồm ca qua đêm.
7. Tạo ca mà không query hoặc validate trạng thái Job.

Nếu Job nguồn bị đóng, paused, expired, archived hoặc không populate được thì ca vẫn phải tạo, xem, sửa, công bố và chấm công bình thường dựa trên Employment.

## 5. ShiftTemplate

Mẫu ca thuộc trực tiếp employer và không phụ thuộc Job.

- Form/API template không bắt chọn bài đăng và không lọc theo `jobId`.
- Template dùng `employerUserId`, `positionTitle`, `dayOfWeek`, `startTime`, `endTime`, `requiredHeadcount`, `effectiveFrom`, `effectiveTo`, `active` và wage override nếu có.
- `jobId` có thể giữ nullable cho legacy nhưng code mới không phụ thuộc vào nó.
- Generate ca phải lọc đúng field `active`; hiện cần kiểm tra lỗi code dùng `isActive` trong khi schema dùng `active`.
- Generate đúng weekday và effective range.
- Ca nháp chưa gán có thể tồn tại nếu model hỗ trợ; trước khi công bố cho một người phải chọn Employment active hợp lệ.

## 6. API và authorization

Sửa `POST /api/shifts`:
- Nhận `employmentId` thay vì bắt buộc `jobId`.
- Input tối thiểu: `employmentId`, ngày, giờ bắt đầu, giờ kết thúc và `isDraft` nếu dùng.
- Không tin employer ID, employee ID, workplace hay wage gửi từ client nếu có thể suy ra từ Employment.

Sửa GET shifts:
- Với `student|worker|freelancer`: chỉ trả ca của chính user và không trả draft.
- Với employer: chỉ trả ca có `employerUserId` là chính employer.
- GET detail áp dụng cùng quy tắc ownership.

Sửa attendance endpoints:
- Chỉ employer owner/admin được gọi.
- Người lao động luôn nhận `403 FORBIDDEN`.
- Không dùng tọa độ Job hoặc GPS làm điều kiện chấm công mới.

Chuẩn hóa lỗi tối thiểu: `FORBIDDEN`, `EMPLOYMENT_NOT_FOUND`, `EMPLOYMENT_INACTIVE`, `SHIFT_CONFLICT`, `INVALID_TRANSITION`, `REASON_REQUIRED`.

## 7. Model, migration và tương thích dữ liệu

- Không xóa database hoặc dữ liệu cũ.
- Không hard-delete Shift, Employment hoặc lịch sử chấm công.
- `Shift.jobId` phải nullable/legacy-only.
- Ưu tiên naming chuẩn `employeeUserId`; nếu giữ `studentUserId`/`studentId` để tương thích thì đồng bộ an toàn và code mới không giả định role luôn là student.
- Snapshot tên nhân viên, position, workplace và wage khi tạo ca.
- Viết migration idempotent để backfill `employmentId` cho Shift cũ dựa trên employer + employee; chỉ dùng Job/source application để hỗ trợ phân giải legacy khi cần.
- Nếu không tìm được đúng một Employment thì ghi warning/report, không đoán và không làm mất dữ liệu.
- Giữ dữ liệu GPS attendance cũ để audit, nhưng luồng mới không yêu cầu GPS.
- Không sửa hoặc xóa Job chỉ vì tách lịch làm khỏi bài đăng.

## 8. Test bắt buộc

### Read-only của người lao động
- Student xem được ca published của mình.
- Worker và freelancer có quyền xem tương tự student.
- Cả ba role không thấy draft và ca người khác.
- Cả ba role gọi check-in/check-out hoặc mutation attendance đều nhận 403.
- `getAllowedShiftActions` không trả `check_in`/`check_out` cho employee.

### Xếp ca theo Employment
- Employer tạo ca chỉ với `employmentId` và thời gian, không có `jobId`.
- Ca lấy đúng employee, position, workplace và wage từ Employment/Profile.
- Employment inactive, terminated, suspended, không tồn tại hoặc thuộc employer khác bị từ chối.
- Job nguồn closed/paused/expired/archived không ảnh hưởng việc tạo ca.
- Phát hiện ca trùng giờ và ca qua đêm.

### Chấm công bởi employer
- Employer owner ghi nhận vào ca, kết thúc ca và vắng mặt đúng transition.
- Student/worker/freelancer không thể tự chấm công dù là người được gán ca.
- Employer khác không thể chấm công.
- Kết thúc trước bắt đầu bị từ chối.
- `workedMinutes` được tính ở server.
- Điều chỉnh giờ công có reason và audit trước/sau.
- Retry không tạo tác dụng phụ lặp.

### Không phụ thuộc Job
- Create/list/detail/publish/reschedule/attendance hoạt động khi Shift không có `jobId`.
- Không endpoint lịch mới nào bắt Job đang mở.
- ShiftTemplate generate không cần `jobId`, lọc đúng `active`, weekday và effective range.

## 9. Cách triển khai và bàn giao

1. Trước khi code, tóm tắt ngắn current flow và các điểm đang sai.
2. Sửa theo thứ tự: domain/model -> service/API/authorization -> migration -> frontend -> tests.
3. Không chỉ đổi label hoặc ẩn nút; backend phải thực sự chặn quyền và bỏ dependency vào Job.
4. Không mở rộng sang module nhiều chi nhánh, blog, micro-task, bản đồ hoặc redesign toàn hệ thống.
5. Giữ giao diện/branding hiện có.
6. Chạy đầy đủ:
   - `cd server && npm test`
   - `cd client && npm run lint`
   - `cd client && npm run build`
7. Báo cáo current flow, file đã sửa, schema/API thay đổi, migration cần chạy, kết quả test/lint/build và giới hạn còn lại.

## Tiêu chí hoàn thành

- Trang lịch của `student`, `worker`, `freelancer` chỉ còn chức năng xem.
- Không còn nút/modal GPS check-in/check-out phía người lao động.
- Gọi API trực tiếp cũng không thể tự chấm công.
- Employer thêm ca bằng cách chọn Employment active, không chọn Job/cơ sở/bài đăng.
- Employer là bên ghi nhận bắt đầu, kết thúc, vắng mặt và duyệt công cho nhân viên.
- Shift và ShiftTemplate hoạt động độc lập với trạng thái/tồn tại của Job.
- EmployerProfile chỉ dùng làm dữ liệu hiển thị fallback, không phát sinh module cơ sở mới.
- Dữ liệu cũ không mất, migration idempotent và lịch sử audit được giữ nguyên.
- Test server, lint và build client thành công, hoặc có báo cáo chính xác về lỗi legacy không liên quan.
```
