# Prompt cho Antigravity Code — làm UI bớt “AI-generated”

Bạn đang làm việc trực tiếp trong repository **Hoa Lac Viec**, một nền tảng việc làm theo ca và việc vặt dành cho sinh viên/khu vực Hòa Lạc.

## Mục tiêu

Hãy **đọc toàn bộ frontend liên quan và chỉnh code thật** để giao diện trông giống một sản phẩm đã được một product designer chủ động thiết kế, thay vì một landing page/dashboard sinh ra từ AI hoặc ghép từ template.

Giữ nhận diện hiện có: thân thiện, địa phương, đáng tin cậy, màu xanh là màu thương hiệu. Tuy nhiên, giảm mạnh cảm giác “pastel SaaS”, bớt trang trí, bớt bo tròn quá mức và tạo phân cấp thông tin rõ hơn.

Không chỉ viết audit hoặc đề xuất. Hãy triển khai thay đổi, chạy kiểm tra và tự xem lại giao diện ở desktop lẫn mobile.

## Bối cảnh kỹ thuật

- Frontend: React 19, Vite, Tailwind CSS 3, React Router, Lucide icons.
- Thư mục làm việc chính: `client/`.
- Design tokens hiện nằm ở `client/tailwind.config.js`.
- Global component styles nằm ở `client/src/index.css`.
- Các component nền tảng cần đọc trước:
  - `client/src/components/Button.jsx`
  - `client/src/components/Badge.jsx`
  - `client/src/components/Form.jsx`
  - `client/src/components/Modal.jsx`
  - `client/src/components/Feedback.jsx`
  - `client/src/components/Nav.jsx`
  - `client/src/components/JobCard.jsx`
- Các layout cần giữ nhất quán:
  - `client/src/layouts/PublicLayout.jsx`
  - `client/src/layouts/StudentLayout.jsx`
  - `client/src/layouts/EmployerLayout.jsx`
  - `client/src/layouts/AdminLayout.jsx`
- Các màn hình đại diện cần ưu tiên:
  - `client/src/pages/public/HomePage.jsx`
  - `client/src/pages/public/JobListPage.jsx`
  - `client/src/pages/public/JobDetailPage.jsx`
  - `client/src/pages/public/LoginPage.jsx`
  - `client/src/pages/public/RegisterPage.jsx`
  - `client/src/pages/student/DashboardPage.jsx`
  - `client/src/pages/employer/EmployerDashboardPage.jsx`
  - `client/src/pages/admin/AdminDashboardPage.jsx`

## Chẩn đoán hiện trạng

Các dấu hiệu đang làm UI trông giống AI/template:

1. Gần như tất cả card đều `rounded-2xl/3xl`, có shadow mềm và hiệu ứng nhấc lên khi hover.
2. Hero dùng đúng công thức quen thuộc: gradient pastel, blob tròn, icon lá trang trí, badge pill phía trên, heading rất lớn và căn giữa.
3. Quá nhiều pill: button pill, badge pill, filter pill, status pill; mọi thành phần có cùng “giọng”.
4. Icon được đặt trong các ô vuông bo tròn, mỗi ô một màu pastel khác nhau; pattern này lặp lại ở category, feature và metric card.
5. Section landing page quá đều và đối xứng: title căn giữa, ba card giống nhau, CTA lớn, spacing rộng tương tự nhau.
6. Dashboard là một tập hợp nhiều “floating card” độc lập; hierarchy giữa dữ liệu chính và phụ chưa đủ rõ.
7. Dùng quá nhiều màu xanh/pink/blue/yellow cho các chi tiết không mang ý nghĩa trạng thái.
8. Copy có xu hướng quảng cáo chung chung, dài và bóng bẩy; chưa đủ cụ thể với bối cảnh sinh viên Hòa Lạc.
9. Animation `fade/slide/scale`, backdrop blur và hover transform xuất hiện theo công thức, không gắn với mục đích sử dụng.
10. Border radius, shadow, padding và typography gần như giống nhau ở mọi cấp, khiến UI thiếu nhịp điệu và chủ đích.

## Hướng thiết kế bắt buộc

Thiết kế theo hướng **local utility / editorial job board**: thực tế, gọn, có chút ấm áp, ưu tiên nội dung và tốc độ đọc. Hình dung một bảng tin tuyển dụng địa phương được làm tốt, không phải một AI startup landing page.

### 1. Visual system

- Giữ xanh thương hiệu nhưng giảm saturation và chỉ dùng nó cho action, active state và tín hiệu quan trọng.
- Chuyển nền chính sang neutral ấm, gần giấy: off-white nhẹ; card chủ yếu là white/neutral.
- Pink chỉ dùng rất tiết chế như accent phụ, không làm nền section lớn.
- Dùng border trung tính mảnh để phân vùng; shadow chỉ dành cho popover, modal hoặc phần tử thật sự nổi.
- Chuẩn hóa radius có chủ đích:
  - control/button/input: khoảng 8–10px;
  - card/container: khoảng 10–14px;
  - badge/status: pill chỉ khi hình dạng pill có lý do ngữ nghĩa;
  - không dùng `rounded-3xl` đại trà.
- Loại bỏ gradient trang trí, blob, blur orb, underline SVG và decorative icon không mang thông tin.
- Không thay mọi thứ bằng đen/trắng lạnh lẽo; vẫn giữ cảm giác gần gũi và đặc trưng Hòa Lạc.

### 2. Typography và hierarchy

- Có thể giữ Be Vietnam Pro nếu chữ tiếng Việt hiển thị tốt; không thêm font chỉ để tạo vẻ mới.
- Giảm kích thước hero headline và tránh câu chữ quá marketing.
- Tạo khác biệt rõ giữa page title, section title, card title, metadata và helper text.
- Hạn chế `font-bold` ở mọi nơi. Ưu tiên regular/medium; chỉ dùng semibold/bold cho tiêu đề và số liệu quan trọng.
- Số liệu lương, thời gian, địa điểm và trạng thái cần quét mắt được nhanh.

### 3. Components

- Buttons: bỏ kiểu pill mặc định; primary chắc, đơn giản, chiều cao nhất quán; secondary/ghost không cần background pastel.
- Cards: ưu tiên border và cấu trúc hàng/cột; chỉ hover bằng thay đổi border/background rất nhẹ, không `translate-y` đại trà.
- Badges: giảm số lượng; chỉ giữ loại việc, xác thực và trạng thái có ích. Không dùng emoji trong badge nếu đã có icon hoặc text.
- Inputs/selects: radius vừa phải, focus ring rõ, label/helper/error nhất quán.
- Navigation: active state tinh tế, không biến mỗi nav item thành một viên capsule; logo không scale khi hover.
- Tables/lists: với dashboard quản trị và danh sách dày dữ liệu, ưu tiên row/list/table thay vì card cho từng record.
- Icon: dùng cùng một màu trong cùng ngữ cảnh; không tạo “rainbow icon boxes” trừ khi màu biểu thị status.

### 4. Home page

- Thiết kế lại hero theo bố cục có chủ đích và thực dụng hơn. Có thể dùng 2 cột hoặc một khối search rõ ràng, nhưng không dùng gradient/blob/badge marketing.
- Nội dung nên cụ thể với người dùng: tìm việc theo ca quanh Hòa Lạc, mức lương, khoảng cách, lịch học.
- Search là hành động chính; CTA cho nhà tuyển dụng là hành động phụ.
- Category nên giống shortcut hoặc danh mục thật, không phải sáu card pastel giống hệt nhau.
- Featured jobs phải là nội dung nổi bật của trang, không bị chìm sau phần hero trang trí.
- “Tại sao chọn…” và “3 bước” không cần mỗi ý một card nổi. Có thể dùng editorial rows, numbered list hoặc separator.
- Gộp/bỏ các section lặp ý. Trang chủ nên ngắn hơn và có nhịp điệu không đồng đều một cách có chủ đích.
- Viết lại microcopy ngắn, tự nhiên, cụ thể; không bịa số liệu như “hàng nghìn sinh viên” nếu repo không có dữ liệu chứng minh.

### 5. Job listing và JobCard

- JobCard phải giúp người dùng đọc theo thứ tự: tên việc → cửa hàng → lương → thời gian/loại ca → địa điểm/khoảng cách → trạng thái/xác thực.
- Không cố nhét mọi metadata thành badge.
- Giảm chiều cao và decoration không cần thiết; card/list item phải scan nhanh trên mobile.
- Featured, match score, distance và verified cần có hierarchy rõ, không cùng tranh giành sự chú ý.
- Chỉ dẫn đường là action phụ, không nên nhìn như một badge nữa.
- Giữ nguyên logic save, điều hướng, distance, match score, API data và map interaction.

### 6. Dashboard và layout theo role

- Loại bỏ welcome banner gradient + orb trang trí. Thay bằng header gọn, lời chào tự nhiên và action phù hợp.
- Metric cards nên gọn, ít màu, dễ so sánh; không cần mỗi metric một icon box pastel.
- Nhóm nội dung theo workflow thực tế: việc cần làm hôm nay, ca sắp tới, đơn đang chờ, hoạt động gần đây.
- Những khối có nhiều bản ghi nên dùng compact list/table với divider.
- Sidebar giữa student/employer/admin phải dùng cùng token và interaction pattern.
- Không thay đổi role guard, route, fetch logic, quyền truy cập hoặc nghiệp vụ.

## Ràng buộc an toàn

- Không thay đổi API contract, schema, endpoint, authentication, role logic, routing hay business rules.
- Không xóa tính năng. Có thể đổi cách trình bày nhưng mọi action hiện tại phải còn hoạt động.
- Không cài UI framework/component library mới.
- Không thêm dependency nếu CSS/Tailwind/Lucide hiện tại làm được.
- Không tạo một bộ component mới song song rồi bỏ component cũ không dùng; hãy refactor design primitives hiện tại.
- Không dùng emoji làm icon UI. Dùng Lucide khi thật sự cần icon.
- Không dùng lorem ipsum hoặc dữ liệu giả để che lỗi layout.
- Giữ responsive và accessibility: keyboard focus, label, contrast, touch target, reduced motion nếu có animation.
- Khi chạm vào file đang có thay đổi dở dang, đọc diff trước và bảo toàn phần thay đổi không liên quan.
- Bảo toàn encoding UTF-8 và toàn bộ dấu tiếng Việt. Nếu terminal hiển thị mojibake, không được ghi đè chuỗi tiếng Việt bằng phiên bản lỗi encoding.

## Cách triển khai

1. Đọc `git status` và diff hiện có trước khi sửa.
2. Audit nhanh các primitive và 4 layout để tìm pattern lặp.
3. Chỉnh token trong `tailwind.config.js` và primitive trong `src/index.css` trước.
4. Refactor component dùng chung (`Button`, `Badge`, `Form`, `Nav`, `JobCard`, feedback states).
5. Làm lại Home page và Job listing làm chuẩn tham chiếu.
6. Lan hệ thống mới sang student/employer/admin dashboard và các trang còn lại; tránh sửa nửa vời khiến hai phong cách cùng tồn tại.
7. Chạy lint/build. Sửa lỗi do thay đổi gây ra.
8. Chạy app và tự kiểm tra trực quan ít nhất ở các viewport:
   - mobile khoảng 390×844;
   - tablet khoảng 768×1024;
   - desktop khoảng 1440×900.
9. Kiểm tra tối thiểu: home, job list, job detail, login/register, một dashboard cho mỗi role, sidebar/mobile menu, modal, empty/loading/error state.
10. Sau visual QA, sửa overflow, spacing, wrapping tiếng Việt, focus state và contrast trước khi kết thúc.

## Tiêu chí nghiệm thu

- Không còn gradient/blob/decorative blur trên hero và dashboard banner.
- `rounded-3xl`, shadow card và hover translate không còn là mặc định khắp hệ thống.
- Pill chỉ còn ở status/tag hợp lý; button/nav/input không mang hình pill đại trà.
- Home page ít section lặp, search và job content nổi bật hơn decoration.
- Job card đọc nhanh, lương và thông tin ca nổi bật; metadata phụ không lấn át title.
- Dashboard có hierarchy theo nhiệm vụ thay vì một lưới card cùng trọng lượng.
- Student/employer/admin/public có cùng một design language.
- Không mất chức năng và không thay đổi contract backend.
- Không có lỗi build/lint mới.
- Không có horizontal overflow ở các viewport đã nêu.
- Chuỗi tiếng Việt hiển thị đúng dấu.

## Kết quả cần báo cáo

Khi hoàn tất, trả lời ngắn gọn bằng tiếng Việt với:

1. Design direction đã áp dụng.
2. Danh sách file chính đã sửa.
3. Những pattern “AI-looking” đã loại bỏ.
4. Kết quả lint/build và các màn hình/viewport đã kiểm tra.
5. Bất kỳ điểm nào chưa thể xác minh do thiếu dữ liệu đăng nhập hoặc backend.

Không dừng ở kế hoạch. Bắt đầu bằng việc đọc code và triển khai ngay.
