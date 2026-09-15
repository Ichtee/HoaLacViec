import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Leaf, LayoutDashboard, Search, Bookmark, FileText,
  Calendar, ArrowLeftRight, Star, DollarSign, User,
  Menu, X, LogOut, ChevronLeft, Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { resetDemoData } from '@/services';

const STUDENT_NAV = [
  { to: '/student', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/student/profile', label: 'Hồ sơ', icon: User },
  { to: '/student/jobs', label: 'Tìm việc', icon: Search },
  { to: '/student/saved', label: 'Đã lưu', icon: Bookmark },
  { to: '/student/applications', label: 'Đơn ứng tuyển', icon: FileText },
  { to: '/student/shifts', label: 'Lịch làm', icon: Calendar },
  { to: '/student/swap', label: 'Sàn đổi ca', icon: ArrowLeftRight },
  { to: '/student/reviews', label: 'Đánh giá', icon: Star },
  { to: '/student/payroll', label: 'Đối soát lương', icon: DollarSign },
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
            ? 'bg-green-main text-white shadow-sm'
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

  function handleReset() {
    if (confirm('Khôi phục dữ liệu demo?')) {
      resetDemoData();
      window.location.reload();
    }
  }

  const sidebar = (
    <aside className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-green-50 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-green-main flex items-center justify-center">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-green-dark">Hoa Lạc Việc</span>
      </div>

      {/* User badge */}
      <div className="px-4 py-3 bg-green-50 mx-3 my-3 rounded-2xl">
        <p className="text-xs text-text-muted">Sinh viên</p>
        <p className="font-semibold text-text-main text-sm truncate">{user?.name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {STUDENT_NAV.map((n) => (
          <SidebarLink key={n.to} {...n} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-green-50 space-y-1">
        <button onClick={handleReset} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-yellow-700 hover:bg-yellow-50 transition-colors">
          <span className="text-base">🔄</span> Khôi phục demo
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
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

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-green-50 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-green-50">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-main flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-green-dark text-sm">Hoa Lạc Việc</span>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-green-50 px-2 py-2 z-20">
          <div className="flex items-center justify-around">
            {STUDENT_NAV.slice(0, 5).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx('flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all', isActive ? 'text-green-main' : 'text-text-light')
                }
              >
                <n.icon className="w-5 h-5" />
                <span className="text-[10px]">{n.label.split(' ')[0]}</span>
              </NavLink>
            ))}
          </div>
        </div>
        <div className="lg:hidden h-20" /> {/* bottom nav spacer */}
      </div>
    </div>
  );
}
