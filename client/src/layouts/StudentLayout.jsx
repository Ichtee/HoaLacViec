import { Outlet, NavLink, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Search, Bookmark, FileText,
  Calendar, ShoppingBag, Star, Menu, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { NotificationDropdown } from '@/components/NotificationDropdown.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';

const STUDENT_NAV = [
  { to: '/student', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/student/jobs', label: 'Tìm việc làm', icon: Search },
  { to: '/student/tasks', label: 'Chợ việc vặt', icon: ShoppingBag },
  { to: '/student/saved', label: 'Việc đã lưu', icon: Bookmark },
  { to: '/student/applications', label: 'Đơn ứng tuyển', icon: FileText },
  { to: '/student/shifts', label: 'Lịch làm việc', icon: Calendar },
  { to: '/student/reviews', label: 'Đánh giá', icon: Star },
];

function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
          isActive
            ? 'bg-gray-100 text-green-dark font-semibold'
            : 'text-text-muted hover:bg-gray-50 hover:text-text-main'
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function StudentLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebar = (
    <aside className="flex flex-col h-full bg-white">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <Link to="/student" className="inline-flex items-center">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
        </Link>
      </div>

      {/* User Info Tile */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] font-medium text-gray-500">
          {user?.role === 'worker' || user?.role === 'freelancer' ? 'Lao động tự do' : 'Sinh viên'}
        </p>
        <p className="font-semibold text-text-main text-xs truncate mt-0.5">{user?.name}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {STUDENT_NAV.map((n) => (
          <SidebarLink key={n.to} {...n} />
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-60 bg-white border-r border-gray-200 flex-col fixed inset-y-0 left-0 z-30">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white z-50 lg:hidden shadow-lg animate-slide-up">
            <div className="absolute top-3.5 right-3">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                aria-label="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationDropdown />
            <UserDropdown showWelcome={true} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
