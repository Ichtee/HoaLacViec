import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Briefcase, Flag, Users, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';

const ADMIN_NAV = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/verification', label: 'Xác thực cơ sở', icon: ShieldCheck },
  { to: '/admin/jobs', label: 'Duyệt tin tuyển', icon: Briefcase },
  { to: '/admin/blogs', label: 'Quản lý bài viết', icon: BookOpen },
  { to: '/admin/reports', label: 'Báo cáo vi phạm', icon: Flag },
  { to: '/admin/users', label: 'Tài khoản người dùng', icon: Users },
];

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-cream flex">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <Link to="/admin" className="inline-flex items-center">
            <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
          </Link>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 uppercase tracking-wider">
            Admin
          </span>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[11px] font-medium text-gray-500">Quản trị viên</p>
          <p className="font-semibold text-text-main text-xs truncate mt-0.5">{user?.name}</p>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {ADMIN_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 text-green-dark font-semibold'
                    : 'text-text-muted hover:bg-gray-50 hover:text-text-main'
                )
              }
            >
              <n.icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
              <span className="truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6">
          <span className="font-semibold text-text-main text-xs">
            Hệ Thống Quản Trị Hoa Lạc Việc
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <UserDropdown showWelcome={true} />
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
