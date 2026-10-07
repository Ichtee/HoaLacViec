# Hoa Lạc Việc (HLV) 🎓💼

> Nền tảng kết nối việc làm thêm bán thời gian, theo ca linh hoạt và việc vặt sinh viên quanh Khu Công Nghệ Cao Hòa Lạc (Đại học FPT, KTX ĐHQG Hà Nội).

---

## 🌟 Tính Năng Nổi Bật

- **Bản Đồ Việc Làm Trực Quan (Vietmap GL JS):** Định vị chính xác cửa hàng, quán cà phê, tiệm ăn quanh Hòa Lạc; hỗ trợ dẫn đường 1-click qua Google Maps.
- **Tìm Kiếm Địa Điểm & Định Vị Thông Minh (Vietmap v4):** Hỗ trợ tra cứu địa điểm, tự động phân giải tọa độ chính xác qua Vietmap Autocomplete & Place v4, ước tính lộ trình xe máy qua Vietmap Route v4 và tính khoảng cách hàng loạt qua Matrix v4.
- **Liên Hệ Nhanh 2 Chiều (Phone & Zalo):** Sinh viên và nhà tuyển dụng có thể gọi điện trực tiếp (`tel:...`) hoặc nhắn tin Zalo (`zalo.me/...`) ngay trên thẻ hồ sơ và trang chi tiết việc làm.
- **Khớp Lịch Học & Ca Làm Tự Động:** Tính toán tỷ lệ trùng khớp (% matching) giữa thời gian rảnh của sinh viên và ca tuyển của quán, cảnh báo xung đột lịch học.
- **Quản Lý Ca Làm & Chấm Công:** Nhà tuyển dụng ghi nhận giờ bắt đầu/kết thúc, duyệt công và xác nhận thanh toán. Người lao động xem lịch và trạng thái ca.
- **Duyệt Tin Tuyển Dụng:** Nhà tuyển dụng đã xác minh gửi tin chờ duyệt; quản trị viên duyệt trước khi tin hiển thị công khai.
- **Chợ Việc Vặt Sinh Viên (Micro-Tasks):** Nền tảng trao đổi các công việc nhỏ trong khuôn viên trường (xe ôm sinh viên, nhận hộ đồ ship, đi chợ, gia sư,...).

**Vai trò và quy trình:** `student`, `worker`, `freelancer` là các vai trò người tìm việc; họ chỉ xem hồ sơ, đơn ứng tuyển và ca của mình. Nhà tuyển dụng đã xác minh tạo tin chờ duyệt; chỉ quản trị viên phê duyệt tin. Sau khi ứng viên chấp nhận đề nghị nhận việc, hệ thống tạo quan hệ làm việc. Quan hệ đã kết thúc không được kích hoạt lại; tuyển dụng lại cần một quan hệ mới.

`hiredCount` đếm số lần tuyển thành công từ một tin, kể cả nhân viên đã nghỉ. Kết thúc quan hệ làm việc không tự mở lại tin hoặc tăng chỉ tiêu; nhà tuyển dụng phải chỉnh tin và gửi duyệt lại nếu muốn tuyển bổ sung.

Với tin cũ có `slots` và `remainingOpenings` lệch nhau, xem trước bằng `cd server && npm run migrate:job-capacity`; chỉ sau khi kiểm tra danh sách mới chạy `npm run migrate:job-capacity -- --apply`. Script không chạy tự động khi khởi động ứng dụng.

**Nộp lại đơn ứng tuyển:** Đơn đã kết thúc (rút, bị từ chối, offer bị từ chối/hết hạn/thu hồi) không còn chặn việc nộp lại cho cùng một tin. Với database đã có dữ liệu, xem trước bằng `cd server && npm run migrate:application-index`, sau đó chạy `npm run migrate:application-index -- --apply` để gán `isActive` cho đơn cũ và thay unique index cũ bằng partial index.

**Tác vụ nền:** Server tự chạy mỗi 10 phút (`MAINTENANCE_INTERVAL_MS` để đổi, `DISABLE_MAINTENANCE_JOBS=true` để tắt): đánh dấu offer quá hạn, chuyển tin quá `closesAt` sang `expired` và nhắc nhân viên các ca bắt đầu trong 2 giờ tới.

**Ảnh xác minh:** Đặt `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` để ảnh thẻ sinh viên, CCCD và giấy phép được tải lên Cloudinary (tên file ngẫu nhiên 128 bit) thay vì lưu base64 trong MongoDB; chỉ loại JPEG/PNG/WebP, tối đa 5MB. Khi thiếu cấu hình, hành vi cũ được giữ nguyên. Chuyển ảnh đã lưu: `cd server && npm run migrate:verification-images` (xem trước), thêm `-- --apply` để thực hiện. Nên sao lưu database trước.

**Phiên đăng nhập:** Access token sống 15 phút (`ACCESS_TOKEN_TTL` để đổi). Refresh token dùng một lần, xoay vòng sau mỗi lần làm mới, chỉ lưu hash trong database và gửi qua cookie httpOnly (`/api/auth/refresh`, `/api/auth/logout`). Đổi hoặc đặt lại mật khẩu thu hồi mọi refresh token. Cookie chỉ gửi được khi frontend gọi `/api` cùng origin (proxy Vercel hoặc Vite); nếu dùng `VITE_API_URL` khác origin, cần cấu hình CORS `credentials` và cookie `SameSite=None`.

**PWA và thông báo đẩy:** Ứng dụng có thể cài lên màn hình chính (manifest + service worker, chỉ đăng ký ở bản production). Để bật Web Push, chạy `cd server && npx web-push generate-vapid-keys`, rồi đặt `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` trên server. Khi thiếu cấu hình, nút bật thông báo đẩy trong chuông thông báo vẫn hiện nhưng máy chủ trả 503 và không gửi push. Mọi thông báo mới trong hệ thống tự động được đẩy tới các thiết bị đã đăng ký.

**Đặt lại mật khẩu:** Cấu hình `FRONTEND_URL`, `RESEND_API_KEY` và `PASSWORD_RESET_FROM_EMAIL` trên server để gửi email. Token chỉ dùng một lần và hết hạn sau 30 phút. Khi thiếu cấu hình, trang sẽ báo chức năng chưa sẵn sàng. Các thao tác duyệt đơn nghỉ có sửa ca cần MongoDB hỗ trợ transaction (ví dụ MongoDB Atlas hoặc replica set).

---

## 🏗️ Cấu Trúc Dự Án

```
├── client/                 # Frontend (React 19 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/     # UI Components (JobCard, JobMap, Modal, Badge,...)
│   │   ├── layouts/        # Layouts cho Student, Employer, Public
│   │   ├── pages/          # Trang màn hình chức năng (Public, Student, Employer, Admin)
│   │   ├── services/       # Tầng giao tiếp API Backend & Vietmap v4
│   │   └── hooks/          # Custom React Hooks (useAuth, useAsync,...)
│   ├── .env.example        # Mẫu biến môi trường Client
│   └── package.json
│
├── server/                 # Backend RESTful API (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── config/         # Kết nối cơ sở dữ liệu MongoDB
│   │   ├── models/         # Mongoose Schemas (User, Job, Application, Shift,...)
│   │   ├── routes/         # Express API Routes
│   │   ├── services/       # Dịch vụ tích hợp bên thứ ba (Vietmap Service, Geocoding)
│   │   └── seed/           # Dữ liệu khởi tạo chuẩn cho khu vực Hòa Lạc
│   ├── .env.example        # Mẫu biến môi trường Server
│   └── package.json
│
├── .gitignore              # Cấu hình bỏ qua tệp nhạy cảm và thư viện build
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Setup)

### Yêu Cầu Tiên Quyết
- **Node.js** >= 18.x
- **MongoDB** đang chạy trên máy cục bộ (`mongodb://127.0.0.1:27017`) hoặc URI MongoDB Atlas.

### 1. Cài đặt Backend (`server`)

```bash
cd server
npm install

# Tạo tệp môi trường từ mẫu
cp .env.example .env

# Chạy seed dữ liệu mẫu khu vực Hòa Lạc (tùy chọn)
node src/seed/seed.js

# Khởi động máy chủ backend
npm run dev
```
Backend API sẽ hoạt động tại `http://localhost:5000`.

### 2. Cài đặt Frontend (`client`)

```bash
cd ../client
npm install

# Tạo tệp môi trường từ mẫu
cp .env.example .env

# Khởi động giao diện dev
npm run dev
```
Client sẽ hoạt động tại `http://localhost:5173`.

---

## 🔐 Biến Môi Trường (Environment Variables)

### Server (`server/.env`)
| Tên Biến | Mô Tả | Mặc Định |
| :--- | :--- | :--- |
| `PORT` | Cổng dịch vụ Express | `5000` |
| `MONGO_URI` | Chuỗi kết nối MongoDB | `mongodb://127.0.0.1:27017/hoalacviec` |
| `JWT_SECRET` | Khóa bí mật ký mã JWT | **Bắt buộc** |
| `VIETMAP_SERVICE_API_KEY` | API Key Vietmap Services (Autocomplete, Place, Reverse, Route, Matrix) — chỉ dùng backend | Cần thiết |
| `VIETMAP_API_BASE_URL` | Base URL Vietmap API | `https://maps.vietmap.vn` |
| `ENABLE_VIETMAP` | Bật tích hợp Vietmap (`true`/`false`) | `false` |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID | Tùy chọn |
| `RESEND_API_KEY` | Khóa API gửi email đặt lại mật khẩu | Cần cho luồng quên mật khẩu |
| `PASSWORD_RESET_FROM_EMAIL` | Địa chỉ gửi thuộc domain đã xác minh ở Resend | Cần cho luồng quên mật khẩu |

### Client (`client/.env`)
| Tên Biến | Mô Tả | Mặc Định |
| :--- | :--- | :--- |
| `VITE_DATA_MODE` | Chế độ dữ liệu (`api` hoặc `mock`) | `api` |
| `VITE_APP_NAME` | Tên thương hiệu hiển thị | `Hoa Lạc Việc` |
| `VITE_VIETMAP_TILE_API_KEY` | Vietmap Tile API Key (render bản đồ vector tile phía client) | Cần thiết |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web Client ID | Tùy chọn |

---

## 🗺️ Cấu Hình Vietmap API Key (Bảo Mật)

Vietmap cấp **2 loại key riêng biệt**. Không dùng chung một key cho cả hai.

### Services Key (`VIETMAP_SERVICE_API_KEY`) — **Backend only**
Dùng cho Autocomplete, Search, Place, Reverse, Route v4 và Matrix v4.

**Bắt buộc trong production:**
- Vào [Vietmap Console](https://maps.vietmap.vn/console-v2/) → chọn project → key management
- **Giới hạn IP server** (whitelist IP của backend/cloud, không mở public)
- **Chỉ bật API đang sử dụng** (Autocomplete, Place, Reverse, Route, Matrix — tắt TSP, VRP)
- **Đặt quota hàng ngày** để tránh overbilling khi bị tấn công
- **Dev và production** dùng key/project riêng
- **Không commit key vào git**, không log key, không log outbound URL

### Tile Key (`VITE_VIETMAP_TILE_API_KEY`) — **Client-side**
Dùng để render bản đồ vector trong trình duyệt. Key này có thể thấy trong JS bundle.

**Bắt buộc trong production:**
- **Giới hạn referring domain** (chỉ cho phép domain production của bạn)
- **Đặt per-key tile quota** để giới hạn thiệt hại nếu key bị lộ
- **Dev và production** dùng key/project riêng



## 🔑 Cấu Hình Đăng Nhập Google (Google Login Setup)

### 1. Cấu hình Google Cloud Console
- Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo/chọn Project của bạn.
- Cấu hình màn hình đồng thuận OAuth (OAuth consent screen / Branding): chọn User Type (External), nhập tên ứng dụng và email hỗ trợ.
- Tạo thông tin xác thực OAuth Client ID: chọn loại ứng dụng là **Web application**.
- Thêm **Authorized JavaScript origins** (Nguồn gốc JavaScript được phép):
  - `http://localhost:5173`
  - `https://client-orcin-two-27.vercel.app`
  - Bất kỳ tên miền sản xuất thực tế nào trong tương lai.
- **Không thêm Authorized redirect URI** (luồng xác thực sử dụng popup ID-token / Google Identity Services, không dùng redirect callback).
- Nếu màn hình OAuth đang ở chế độ **Testing**, hãy thêm email Google của các thành viên phát triển vào danh sách **Test users**.

### 2. Cấu hình môi trường cục bộ (Local Environment)
Cả frontend và backend đều sử dụng chung một Google Web Client ID (Client ID là thông tin public, không cần Client Secret cho luồng popup này):
- `client/.env`:
  ```env
  VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
  ```
- `server/.env`:
  ```env
  GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
  ```

### 3. Cấu hình triển khai (Deployment)
- **Vercel (Frontend):** Thiết lập biến `VITE_GOOGLE_CLIENT_ID` trong Project Settings > Environment Variables, sau đó **redeploy lại frontend** (Lưu ý: các biến môi trường `VITE_*` được nhúng trực tiếp vào bundle tĩnh trong quá trình build của Vite, do đó Vercel cần một lượt build/deployment mới sau khi thêm hoặc cập nhật biến).
- **Render (Backend):** Thiết lập biến `GOOGLE_CLIENT_ID` trong Environment tab của Web Service và redeploy backend.

---

## 📝 Bản Quyền & Giấy Phép
Dự án phát triển phục vụ sinh viên và cộng đồng kinh doanh tại Hòa Lạc.
