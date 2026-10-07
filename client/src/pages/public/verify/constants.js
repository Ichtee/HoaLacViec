export const STORE_TYPES = [
  { value: 'Quán cà phê', label: 'Quán cà phê / Trà sữa' },
  { value: 'Quán ăn / Nhà hàng', label: 'Quán ăn / Nhà hàng' },
  { value: 'Cửa hàng tiện lợi', label: 'Cửa hàng tiện lợi / Siêu thị mini' },
  { value: 'Shop thời trang / Phụ kiện', label: 'Shop thời trang / Phụ kiện' },
  { value: 'Tiệm photocopy / In ấn', label: 'Tiệm photocopy / In ấn' },
  { value: 'Khác', label: 'Mô hình kinh doanh khác' },
];

export const WORKER_PROFESSIONS = [
  { value: 'Giao hàng / Shipper', label: 'Giao hàng / Shipper' },
  { value: 'Phục vụ bàn / Pha chế', label: 'Phục vụ bàn / Pha chế' },
  { value: 'Bán hàng / Thu ngân', label: 'Bán hàng / Thu ngân' },
  { value: 'Tạp vụ / Dọn dẹp / Buồng phòng', label: 'Tạp vụ / Dọn dẹp / Buồng phòng' },
  { value: 'Thợ sửa chữa / Kỹ thuật', label: 'Thợ sửa chữa / Điện nước / Kỹ thuật' },
  { value: 'Bảo vệ / Lễ tân', label: 'Bảo vệ / Trông xe / Lễ tân' },
  { value: 'Gia sư / Trợ giảng', label: 'Gia sư / Trợ giảng' },
  { value: 'Lao động phổ thông tự do', label: 'Lao động phổ thông tự do khác' },
];

export function getRoleLabel(role) {
  if (role === 'student') return 'Sinh viên';
  if (role === 'worker') return 'Lao động tự do';
  if (role === 'employer') return 'Nhà tuyển dụng';
  return '';
}
