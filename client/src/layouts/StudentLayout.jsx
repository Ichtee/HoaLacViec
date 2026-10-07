import { Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Bookmark,
  FileText,
  Calendar,
  ShoppingBag,
  Star,
  Zap,
  MessageCircle,
  BellRing,
  Repeat,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useNavBadges } from '@/hooks/useNavBadges.js';
import { NotificationDropdown } from '@/components/NotificationDropdown.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';
import { SidebarNav, BottomNav } from '@/components/NavMenu.jsx';

const STUDENT_NAV_GROUPS = [
  { items: [{ to: '/student', label: 'Tổng quan', icon: LayoutDashboard, end: true }] },
  {
    title: 'Tìm việc',
    items: [
      { to: '/student/jobs', label: 'Tìm việc', icon: Search },
      { to: '/student/quick-shifts', label: 'Ca lẻ', icon: Zap },
      { to: '/student/tasks', label: 'Chợ việc vặt', icon: ShoppingBag },
      { to: '/student/saved', label: 'Đã lưu', icon: Bookmark },
      { to: '/student/alerts', label: 'Thông báo việc', icon: BellRing },
    ],
  },
  {
    title: 'Việc của tôi',
    items: [
      { to: '/student/applications', label: 'Đơn ứng tuyển', icon: FileText },
      { to: '/student/shifts', label: 'Lịch làm', icon: Calendar },
      { to: '/student/swaps', label: 'Đổi ca', icon: Repeat },
      { to: '/student/reviews', label: 'Đánh giá', icon: Star },
    ],
  },
  {
    title: 'Liên lạc',
    items: [{ to: '/student/messages', label: 'Tin nhắn', icon: MessageCircle, badgeKey: 'messages' }],
  },
];

// Bốn mục dùng nhiều nhất trên điện thoại; phần còn lại nằm trong "Thêm"
const STUDENT_BOTTOM_NAV = [
  { to: '/student', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/student/jobs', label: 'Tìm việc', icon: Search },
  { to: '/student/shifts', label: 'Lịch làm', icon: Calendar },
  { to: '/student/messages', label: 'Tin nhắn', icon: MessageCircle, badgeKey: 'messages' },
];

export default function StudentLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const badges = useNavBadges(Boolean(user));

  const sidebar = (
    <aside className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-green-50 flex items-center justify-center sm:justify-start">
        <Link to="/student" className="inline-flex items-center group">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
      </div>

      {/* User badge */}
      <div className="px-4 py-3 bg-green-50 mx-3 my-3 rounded-2xl border border-green-100/50">
        <p className="text-[11px] font-semibold text-green-dark">
          {user?.role === 'worker' || user?.role === 'freelancer' ? 'Lao động tự do Hòa Lạc' : 'Sinh viên Hòa Lạc'}
        </p>
        <p className="font-bold text-text-main text-sm truncate mt-0.5">{user?.name}</p>
      </div>

      <SidebarNav groups={STUDENT_NAV_GROUPS} badges={badges} onNavigate={() => setSidebarOpen(false)} />
    </aside>
  );

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 bg-white border-r border-green-50 flex-col fixed inset-y-0 left-0 z-30">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden shadow-modal animate-slide-up">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-green-50" aria-label="Đóng menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-green-50 h-16 flex items-center justify-between px-4 sm:px-6">
          <Link to="/student" className="lg:hidden inline-flex items-center" aria-label="Trang chủ">
            <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationDropdown />
            <UserDropdown showWelcome={true} />
          </div>
        </header>

        {/* Page content (chừa chỗ cho thanh điều hướng dưới đáy trên điện thoại) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <BottomNav items={STUDENT_BOTTOM_NAV} badges={badges} onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
