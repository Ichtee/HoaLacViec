# Hoa Lạc Việc (HLV) 🎓💼

> Nền tảng kết nối việc làm thêm bán thời gian, theo ca linh hoạt và việc vặt sinh viên quanh Khu Công Nghệ Cao Hòa Lạc (Đại học FPT, KTX ĐHQG Hà Nội).

---

## 🌟 Tính Năng Nổi Bật

- **Bản Đồ Việc Làm Trực Quan (Leaflet & Google Maps):** Định vị chính xác cửa hàng, quán cà phê, tiệm ăn quanh Hòa Lạc; hỗ trợ dẫn đường 1-click qua Google Maps.
- **Tìm Kiếm Địa Điểm Thông Minh (SerpApi & Open-API VN):** Hỗ trợ nhà tuyển dụng chọn Tỉnh / Huyện / Xã theo chuẩn hành chính Việt Nam và tra cứu tọa độ cửa hàng tự động.
- **Liên Hệ Nhanh 2 Chiều (Phone & Zalo):** Sinh viên và nhà tuyển dụng có thể gọi điện trực tiếp (`tel:...`) hoặc nhắn tin Zalo (`zalo.me/...`) ngay trên thẻ hồ sơ và trang chi tiết việc làm.
- **Khớp Lịch Học & Ca Làm Tự Động:** Tính toán tỷ lệ trùng khớp (% matching) giữa thời gian rảnh của sinh viên và ca tuyển của quán, cảnh báo xung đột lịch học.
- **Quản Lý Ca Làm & Điểm Danh GPS:** Hỗ trợ sinh viên check-in / check-out ca làm việc và chủ quán phê duyệt chấm công theo thời gian thực.
- **Chợ Việc Vặt Sinh Viên (Micro-Tasks):** Nền tảng trao đổi các công việc nhỏ trong khuôn viên trường (xe ôm sinh viên, nhận hộ đồ ship, đi chợ, gia sư,...).

---

## 🏗️ Cấu Trúc Dự Án

```
├── client/                 # Frontend (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/     # UI Components (JobCard, JobMap, Modal, Badge,...)
│   │   ├── layouts/        # Layouts cho Student, Employer, Public
│   │   ├── pages/          # Trang màn hình chức năng (Public, Student, Employer, Admin)
│   │   ├── services/       # Tầng giao tiếp API Backend & Google Maps / SerpApi
│   │   └── hooks/          # Custom React Hooks (useAuth, useAsync,...)
│   ├── .env.example        # Mẫu biến môi trường Client
│   └── package.json
│
├── server/                 # Backend RESTful API (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── config/         # Kết nối cơ sở dữ liệu MongoDB
│   │   ├── models/         # Mongoose Schemas (User, Job, Application, Shift,...)
│   │   ├── routes/         # Express API Routes
│   │   ├── services/       # Dịch vụ tích hợp bên thứ ba (SerpApi Cache, Geocoding)
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
| `JWT_SECRET` | Khóa bí mật ký mã JWT | Tùy chọn bảo mật |
| `SERPAPI_API_KEY` | API Key SerpApi tra cứu vị trí Google Maps | Tùy chọn |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID cho backend xác thực token | Tùy chọn |

### Client (`client/.env`)
| Tên Biến | Mô Tả | Mặc Định |
| :--- | :--- | :--- |
| `VITE_DATA_MODE` | Chế độ dữ liệu (`api` hoặc `mock`) | `api` |
| `VITE_APP_NAME` | Tên thương hiệu hiển thị | `Hoa Lạc Việc` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API Key | Tùy chọn |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web Client ID cho nút Đăng nhập Google | Tùy chọn |

---

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

