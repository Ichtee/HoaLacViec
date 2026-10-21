const PUBLIC = {
  '/': 'Trang chủ',
  '/jobs': 'Danh sách việc làm',
  '/tasks': 'Việc nhỏ (micro-task)',
  '/tasks/create': 'Đăng việc nhỏ',
  '/blogs': 'Blog',
  '/login': 'Đăng nhập',
  '/register': 'Đăng ký',
  '/reset-password': 'Quên / đặt lại mật khẩu',
  '/verify-account': 'Xác thực tài khoản',
};

const SECTIONS = { student: 'Sinh viên', employer: 'Nhà tuyển dụng', admin: 'Quản trị' };

const SUB = {
  account: 'Tài khoản', alerts: 'Thông báo việc làm', applications: 'Đơn ứng tuyển', blogs: 'Blog',
  'blogs/new': 'Viết blog', 'change-password': 'Đổi mật khẩu', credits: 'Credit', employees: 'Nhân viên',
  jobs: 'Tin tuyển dụng', 'jobs/create': 'Đăng tin', messages: 'Tin nhắn', profile: 'Hồ sơ',
  'quick-shifts': 'Ca làm nhanh', reports: 'Phản hồi', reviews: 'Đánh giá', saved: 'Việc đã lưu',
  shifts: 'Ca làm', swaps: 'Đổi ca', tasks: 'Việc nhỏ', 'tasks/create': 'Đăng việc nhỏ',
  topups: 'Nạp tiền', users: 'Tài khoản người dùng', verification: 'Xác thực hồ sơ',
};

/** Đường dẫn của trang → tên tiếng Việt; trang lạ thì giữ nguyên đường dẫn. */
export function pageName(path = '/') {
  const clean = path.length > 1 ? path.replace(/\/$/, '') : path;
  if (PUBLIC[clean]) return PUBLIC[clean];
  if (/^\/jobs\/[^/]+$/.test(clean)) return 'Chi tiết tin tuyển dụng';
  if (/^\/blogs\/[^/]+$/.test(clean)) return 'Chi tiết bài blog';
  const [, section, ...rest] = clean.split('/');
  if (SECTIONS[section]) {
    const sub = rest.join('/');
    if (!sub) return `${SECTIONS[section]} – Tổng quan`;
    if (/^jobs\/[^/]+\/edit$/.test(sub)) return `${SECTIONS[section]} – Sửa tin`;
    if (/^blogs\/[^/]+\/edit$/.test(sub)) return `${SECTIONS[section]} – Sửa blog`;
    if (/^jobs\/[^/]+$/.test(sub)) return `${SECTIONS[section]} – Chi tiết tin`;
    if (SUB[sub]) return `${SECTIONS[section]} – ${SUB[sub]}`;
  }
  return clean;
}
