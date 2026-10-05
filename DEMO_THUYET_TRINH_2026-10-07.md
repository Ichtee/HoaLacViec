# Kịch bản thuyết trình và kiểm tra demo Hoa Lạc Việc

**Ngày trình bày:** 07/10/2026. **Thời lượng gợi ý:** 10–12 phút.

## 1. Kết quả kiểm tra ngày 06/10/2026

| Hạng mục | Kết quả | Phạm vi xác nhận |
| --- | --- | --- |
| Backend `npm test` | 172/172 test đạt | Phân quyền, xác thực, đơn ứng tuyển, vòng đời tuyển dụng, ca làm, chấm công, nghỉ phép, việc vặt, vị trí, bản đồ, blog. Phần lớn là test logic/API giả lập; chưa thay thế thử nghiệm trên cơ sở dữ liệu thật. |
| Frontend `npm run build` | Đạt | Biên dịch được. Vite cảnh báo hai bundle lớn hơn 500 kB, có thể làm tải trang chậm trên mạng yếu. |
| Frontend `npm run lint` | 0 lỗi, 223 cảnh báo | Có cảnh báo về biến không dùng, dependencies của hook và cập nhật state trong effect; chưa xác nhận chúng gây lỗi lúc demo. |
| Frontend `npm run smoke` | Đạt | Màn quản lý ca, Modal và Toast render được trong smoke test. |
| Kiểm tra API trên MongoDB replica set cô lập | 70/70 bước đạt sau khi sửa lỗi | Đăng nhập 3 vai trò, tạo/duyệt tin, ứng tuyển, offer, nhân viên, mẫu ca, chấm công, thanh toán, nghỉ phép, việc vặt, đánh giá, báo cáo và blog. Đây là luồng API thật trên dữ liệu thử nghiệm, không phải dữ liệu triển khai. |
| Render các trang frontend | 33/33 trang đạt | Render phía server với provider tương ứng; kiểm tra trang không văng lỗi lúc render ban đầu. Chưa kiểm tra thao tác nút trong trình duyệt. |
| Bấm nút trực tiếp trên UI | Chưa xác nhận | Dịch vụ điều khiển trình duyệt/Windows của môi trường kiểm tra không khả dụng. Cần chạy checklist phía dưới trên máy sẽ trình chiếu. |

**Lưu ý dữ liệu:** Không chạy `npm run seed` trên database dùng để demo: `server/src/seed/seed.js` xóa các collection hiện có trước khi tạo dữ liệu mới. Script `seedEmployerData.js` cũng xóa quan hệ nhân viên của nhà tuyển dụng mẫu. Chỉ dùng với database thử nghiệm riêng đã có bản sao lưu.

**Lỗi đã sửa sau khi chạy luồng thật:** Script seed tạo người dùng mẫu ở trạng thái `pending` nên admin không vào được trang quản trị; hiện các tài khoản mẫu có `status: active` và script chặn chạy trong production. Tạo mẫu ca gắn với tin của chính nhà tuyển dụng từng trả `403` vì so sánh ID hồ sơ cửa hàng với ID người dùng; đã sửa kiểm tra chủ sở hữu. Ghi nhận vào/ra ca từng trả `400` do gán lại toàn bộ đối tượng chấm công với các tọa độ `undefined`; đã sửa cập nhật từng trường. Sau các sửa này, kiểm tra API đạt 70/70.

## 2. Chuẩn bị trước khi mở màn hình

1. Kiểm tra backend `/api/health` trả `200`, database hiện `MongoDB Connected`. Kiểm tra frontend gọi đúng backend; môi trường dev dùng Vite proxy từ `localhost:5173` tới `localhost:5000`.
2. Đăng nhập thử ba tài khoản **đang hoạt động**: sinh viên, nhà tuyển dụng đã xác minh, quản trị viên. Chuẩn bị sẵn mật khẩu trong trình quản lý mật khẩu; tránh để lộ khi chia sẻ màn hình.
3. Chuẩn bị một tin tuyển dụng đã được duyệt, còn chỉ tiêu, một tin chờ duyệt, một đơn ứng tuyển tại từng bước quan trọng, một nhân viên có ca sắp tới và một việc vặt đang mở. Nếu demo live, dùng bản dữ liệu thử nghiệm vì các thao tác duyệt, tuyển, xếp ca và thanh toán làm thay đổi trạng thái.
4. Mở ba cửa sổ hoặc ba browser profile theo vai trò để chuyển nhanh. Kiểm tra quyền GPS, bản đồ Vietmap và đường dẫn Google Maps ngay trên máy thuyết trình. Đặt zoom trình duyệt khoảng 90–100%.
5. Quên mật khẩu chỉ nên demo nếu email Resend đã cấu hình. Trong cấu hình local hiện chưa thấy `RESEND_API_KEY`; không đưa bước gửi email vào luồng chính.

## 3. Lời dẫn và thao tác demo theo chức năng

### Mở đầu — 45 giây

**Lời nói:** “Hoa Lạc Việc là nền tảng kết nối người tìm việc và cơ sở kinh doanh quanh khu Hòa Lạc. Bài toán chúng em giải quyết là tìm việc phù hợp với lịch học, khoảng cách di chuyển và nhu cầu tuyển theo ca. Hệ thống có ba vai trò chính: người tìm việc, nhà tuyển dụng và quản trị viên; ngoài ra có chợ việc vặt cho các nhu cầu ngắn hạn.”

**Thao tác:** Mở trang chủ, chỉ vào menu Tìm việc, Chợ việc vặt và Blog.

### 1. Đăng ký, đăng nhập và xác minh tài khoản — 1 phút

**Lời nói:** “Người dùng có thể đăng ký bằng email và mật khẩu, hoặc đăng nhập bằng Google khi cấu hình OAuth sẵn sàng. Tài khoản mới đi qua bước chọn và xác minh vai trò. Quyền truy cập sau đăng nhập được tách theo vai trò, để sinh viên, nhà tuyển dụng và quản trị viên chỉ thấy phần việc của mình.”

**Thao tác:** Giới thiệu màn Đăng nhập/Đăng ký và màn Xác minh tài khoản bằng dữ liệu đã chuẩn bị. Đăng nhập tài khoản sinh viên. Nếu không có hồ sơ pending, chỉ trình bày màn xác minh bằng ảnh chụp dự phòng, không tạo tài khoản mới trong lúc trình bày.

### 2. Tìm việc, lọc và bản đồ — 1 phút

**Lời nói:** “Danh sách chỉ hiển thị các tin công khai đã được duyệt. Người tìm việc có thể tìm theo từ khóa và bộ lọc, xem lương, địa chỉ, vị trí tuyển và ca làm. Bản đồ giúp hình dung nơi làm việc; nút chỉ đường mở Google Maps theo địa chỉ của tin.”

**Thao tác:** Mở `/jobs` hoặc `/student/jobs`, thử một bộ lọc, chuyển qua bản đồ, chọn một tin và mở chi tiết. Nếu GPS bị từ chối, dùng tìm kiếm và bản đồ không phụ thuộc vị trí hiện tại. Nếu map tile không tải, tiếp tục ở danh sách và chi tiết việc làm.

### 3. Hồ sơ, lịch rảnh và lưu việc — 1 phút

**Lời nói:** “Người tìm việc cập nhật hồ sơ, kỹ năng và lịch rảnh để nhà tuyển dụng có thông tin xem xét. Từ trang chi tiết, các bạn có thể lưu tin để xem lại, thay vì phải tìm từ đầu. Hệ thống cũng có phần gợi ý mức độ phù hợp theo lịch.”

**Thao tác:** Mở Hồ sơ, chỉ vào kỹ năng và lịch rảnh; lưu một tin rồi mở mục Đã lưu. Nếu cần thao tác an toàn, dùng một tin chưa được lưu và bỏ lưu lại sau demo.

### 4. Ứng tuyển và theo dõi đơn — 1 phút

**Lời nói:** “Ở tin phù hợp, sinh viên chọn vị trí, ca mong muốn, nhập số liên hệ và lời nhắn để gửi đơn. Sau khi gửi, mục Đơn ứng tuyển thể hiện trạng thái xử lý. Khi nhà tuyển dụng gửi đề nghị nhận việc, ứng viên có thể chấp nhận hoặc từ chối.”

**Thao tác:** Mở chi tiết tin, chỉ ra nút Ứng tuyển ngay và các trường trong form. Nếu có dữ liệu thử nghiệm, gửi một đơn mới; chuyển sang `/student/applications` để xem đơn và một offer đã chuẩn bị.

### 5. Nhà tuyển dụng tạo và quản lý tin — 1 phút

**Lời nói:** “Nhà tuyển dụng khai báo cửa hàng, tạo tin với mô tả, mức lương, vị trí và địa điểm. Tin gửi lên sẽ ở trạng thái chờ duyệt; sau khi quản trị viên phê duyệt mới xuất hiện công khai. Nhà tuyển dụng còn có thể chỉnh sửa, tạm dừng hoặc đóng tin theo nhu cầu tuyển.”

**Thao tác:** Đăng nhập tài khoản nhà tuyển dụng, mở `/employer/profile`, `/employer/jobs` và form tạo tin. Chỉ vào phần xác nhận vị trí trên bản đồ. Dùng một tin nháp đã chuẩn bị để tránh mất thời gian nhập form.

### 6. Quy trình tuyển dụng và nhân viên — 1 phút 15 giây

**Lời nói:** “Hồ sơ đi qua sàng lọc, phỏng vấn và đề nghị nhận việc. Sau khi ứng viên chấp nhận offer, hệ thống tạo quan hệ nhân viên để nhà tuyển dụng tiếp tục quản lý ca. Các bước được kiểm soát theo trạng thái, nên không thể nhảy thẳng từ đơn mới sang đã tuyển.”

**Thao tác:** Mở `/employer/applications`, chỉ các tab trạng thái và một hồ sơ ở bước offer; sau đó mở `/employer/employees` để xem nhân viên đã nhận việc. Nếu thao tác trực tiếp, dùng hồ sơ thử nghiệm chưa có offer.

### 7. Xếp ca, chấm công, nghỉ phép và thanh toán — 1 phút 30 giây

**Lời nói:** “Nhà tuyển dụng tạo ca thủ công hoặc từ mẫu định kỳ, kiểm tra xung đột trước khi công bố lịch tuần. Nhân viên xem ca ở cổng người tìm việc và gửi đơn xin nghỉ. Nhà tuyển dụng ghi nhận giờ bắt đầu, kết thúc, duyệt công rồi chuyển sang tính lương và xác nhận đã thanh toán. Trạng thái duyệt công và đã trả lương được tách riêng.”

**Thao tác:** Mở `/employer/shifts`, lần lượt chỉ Lịch tuần, Duyệt công, Tính lương, Đơn xin nghỉ. Chuyển sang `/student/shifts` để cho thấy góc nhìn người lao động. Chuẩn bị sẵn ca ở từng trạng thái; không cần tạo rồi chờ ca diễn ra trong buổi demo.

### 8. Chợ việc vặt — 1 phút

**Lời nói:** “Ngoài tin tuyển dụng dài hơn, người dùng có thể đăng nhu cầu ngắn hạn như giao đồ, mua hộ hoặc hỗ trợ học tập. Một sinh viên khác nhận việc, gửi xác nhận hoàn thành; người đăng kiểm tra và đánh giá. Nếu có tranh chấp, người dùng tạo báo cáo để quản trị viên xử lý.”

**Thao tác:** Mở `/tasks`, lọc danh mục, mở một việc; chỉ form `/tasks/create` và các tab việc của tôi. Nếu demo nhận việc trực tiếp, dùng hai tài khoản sinh viên thử nghiệm khác nhau.

### 9. Quản trị viên kiểm duyệt và nội dung — 1 phút

**Lời nói:** “Quản trị viên theo dõi số liệu tổng quan, duyệt xác minh tài khoản và tin tuyển dụng, xử lý báo cáo vi phạm, quản lý tài khoản và biên tập bài viết. Nhờ lớp kiểm duyệt, các tin chưa hợp lệ không xuất hiện trên trang công khai.”

**Thao tác:** Đăng nhập admin, mở `/admin`, lần lượt vào Xác minh, Tin tuyển dụng, Báo cáo, Người dùng và Blog. Chỉ một tin chờ duyệt và trạng thái sau khi duyệt; chỉ duyệt thật trên database demo.

### 10. Blog, đánh giá và thông báo — 45 giây

**Lời nói:** “Blog cung cấp nội dung hỗ trợ tìm việc và tuyển dụng. Sau khi hoàn thành tương tác, hệ thống có phần đánh giá để xây dựng uy tín. Thông báo trên giao diện giúp người dùng theo dõi những thay đổi quan trọng mà không phải kiểm tra từng màn hình.”

**Thao tác:** Mở `/blogs`, một bài viết, mục `/student/reviews` và biểu tượng thông báo ở header.

### Kết thúc — 30 giây

**Lời nói:** “Luồng xuyên suốt là: doanh nghiệp được xác minh, đăng tin và chờ duyệt; sinh viên tìm việc, ứng tuyển và nhận offer; doanh nghiệp chuyển ứng viên thành nhân viên, xếp ca và thanh toán; quản trị viên giám sát chất lượng. Đây là vòng đời công việc từ tìm kiếm đến vận hành sau tuyển dụng.”

## 4. Checklist thử trực tiếp trước buổi trình bày

Đánh dấu sau khi kiểm tra trên **đúng môi trường sẽ trình chiếu**:

- [ ] `/api/health` trả 200 và kết nối MongoDB; frontend không hiện lỗi kết nối API.
- [ ] Ba vai trò đăng nhập được; tài khoản pending đi tới trang xác minh; truy cập sai vai trò bị chặn.
- [ ] Danh sách việc có dữ liệu; lọc, chi tiết, lưu việc và nút chỉ đường hoạt động.
- [ ] Map Vietmap tải được; không có lỗi key/quota; thử cả khi từ chối GPS.
- [ ] Sinh viên gửi đơn trên tin được duyệt, xem trạng thái; thử trùng đơn/thiếu số điện thoại để thấy thông báo lỗi hợp lý.
- [ ] Nhà tuyển dụng mở hồ sơ ứng viên, chuyển trạng thái, gửi offer; ứng viên chấp nhận; hồ sơ nhân viên xuất hiện.
- [ ] Tạo ca nháp, kiểm tra xung đột, công bố, xem ở hai vai trò; xin nghỉ và duyệt; chấm công, duyệt công, thanh toán trên dữ liệu mẫu.
- [ ] Đăng và nhận việc vặt bằng hai tài khoản; xác nhận hoàn thành, đánh giá; thử báo cáo nếu có dữ liệu chuẩn bị.
- [ ] Admin duyệt xác minh và tin; kiểm tra tin xuất hiện công khai; báo cáo, blog và tài khoản hiển thị đúng.
- [ ] Google Login và email quên mật khẩu chỉ đưa vào demo nếu cấu hình ngoài đã được thử thành công.

## 5. Vấn đề và phương án khi demo

- **Chưa có kết quả end-to-end trên database thật:** không nên nói “đã test toàn bộ trên giao diện” trước khi checklist mục 4 được đánh dấu. Nếu backend không kết nối, trình bày bằng dữ liệu/chụp màn hình dự phòng và nói rõ đó là bản minh họa.
- **Atlas hoặc Render khởi động chậm:** mở trang trước giờ trình bày, kiểm tra health, giữ tab đang đăng nhập. Nếu lỗi mạng, dùng video/chụp màn hình luồng đã chuẩn bị.
- **Vietmap/GPS phụ thuộc môi trường:** ưu tiên danh sách và chi tiết công việc nếu bản đồ không tải. Nút chỉ đường cần địa chỉ tin hợp lệ.
- **Vite cảnh báo bundle lớn:** tải thử các trang chính trước giờ demo trên chính mạng sẽ dùng.
- **Các thao tác ghi có tính trạng thái:** dùng database demo riêng và bản ghi đã chuẩn bị; không chạy seed hoặc migration ghi dữ liệu trên database cần giữ nguyên.
