import { ShoppingBag, Utensils, Bike, Truck, Package, Printer, AlertTriangle } from 'lucide-react';

export const TASK_CATEGORIES = [
  { id: 'all', label: 'Tất cả danh mục', icon: null },
  { id: 'di_cho', label: 'Đi chợ / Mua cơm', icon: ShoppingBag, color: 'text-amber-600 bg-amber-50' },
  { id: 'nau_an', label: 'Nấu ăn hộ', icon: Utensils, color: 'text-orange-700 bg-orange-50' },
  { id: 'xe_om', label: 'Xe ôm sinh viên', icon: Bike, color: 'text-blue-600 bg-blue-50' },
  { id: 'chuyen_do', label: 'Chuyển đồ / Dọn phòng', icon: Truck, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'lay_ship', label: 'Nhận ship / Lấy hàng', icon: Package, color: 'text-purple-600 bg-purple-50' },
  { id: 'khac', label: 'Việc khác', icon: Printer, color: 'text-emerald-700 bg-emerald-50' },
];

export const TASK_TABS = [
  { id: 'open', label: 'Chợ việc vặt (Đang tìm người)', icon: ShoppingBag },
  { id: 'my_posted', label: 'Việc tôi nhờ (Đã đăng)', icon: null },
  { id: 'my_accepted', label: 'Việc tôi nhận làm', icon: null },
  { id: 'awaiting_approval', label: 'Chờ nghiệm thu', icon: null },
  { id: 'completed', label: 'Đã hoàn thành', icon: null },
  { id: 'disputed', label: 'Cần hỗ trợ / Khiếu nại', icon: AlertTriangle },
];
