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

### Client (`client/.env`)
| Tên Biến | Mô Tả | Mặc Định |
| :--- | :--- | :--- |
| `VITE_DATA_MODE` | Chế độ dữ liệu (`api` hoặc `mock`) | `api` |
| `VITE_APP_NAME` | Tên thương hiệu hiển thị | `Hoa Lạc Việc` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API Key | Tùy chọn |

---

## 📝 Bản Quyền & Giấy Phép
Dự án phát triển phục vụ sinh viên và cộng đồng kinh doanh tại Hòa Lạc.
