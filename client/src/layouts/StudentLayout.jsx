import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Leaf, LayoutDashboard, Search, Bookmark, FileText,
  Calendar, ShoppingBag, Star, User,
  Menu, X, LogOut, ChevronLeft, Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { NotificationDropdown } from '@/components/NotificationDropdown.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';

const STUDENT_NAV = [
  { to: '/student', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/student/profile', label: 'Hồ sơ', icon: User },
  { to: '/student/jobs', label: 'Tìm việc', icon: Search },
  { to: '/student/tasks', label: 'Chợ việc vặt', icon: ShoppingBag },
  { to: '/student/saved', label: 'Đã lưu', icon: Bookmark },
  { to: '/student/applications', label: 'Đơn ứng tuyển', icon: FileText },
  { to: '/student/shifts', label: 'Lịch làm', icon: Calendar },
  { to: '/student/reviews', label: 'Đánh giá', icon: Star },
];

function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-green-main text-white shadow-sm font-semibold'
            : 'text-text-muted hover:bg-green-50 hover:text-green-dark'
        )
      }
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0 w-5 h-5" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const sidebar = (
    <aside className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-green-50 flex items-center justify-center sm:justify-start">
        <Link to="/" className="inline-flex items-center group">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
      </div>

      {/* User badge */}
      <div className="px-4 py-3 bg-green-50 mx-3 my-3 rounded-2xl border border-green-100/50">
        <p className="text-[11px] font-semibold text-green-dark">Sinh viên Hòa Lạc</p>
        <p className="font-bold text-text-main text-sm truncate mt-0.5">{user?.name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {STUDENT_NAV.map((n) => (
          <SidebarLink key={n.to} {...n} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-green-50">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 font-medium transition-colors">
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
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
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-green-50">
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
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-green-50"
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
