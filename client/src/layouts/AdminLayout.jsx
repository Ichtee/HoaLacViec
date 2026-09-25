import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { Leaf, LayoutDashboard, ShieldCheck, Briefcase, Flag, Users, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';

const ADMIN_NAV = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/verification', label: 'Xác thực nhà TD', icon: ShieldCheck },
  { to: '/admin/jobs', label: 'Kiểm duyệt tin', icon: Briefcase },
  { to: '/admin/reports', label: 'Báo cáo', icon: Flag },
  { to: '/admin/users', label: 'Tài khoản', icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-green-dark text-white flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-4 py-3.5 border-b border-green-700 flex items-center justify-between">
          <Link to="/admin" className="bg-white px-3 py-1.5 rounded-2xl inline-flex items-center shadow-sm">
            <img src="/logo.png" alt="Hoa Lạc Việc" className="h-10 w-auto object-contain" />
          </Link>
          <span className="font-bold text-[11px] uppercase tracking-wider text-green-200">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {ADMIN_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive ? 'bg-white/20' : 'text-green-200 hover:bg-white/10 hover:text-white')
              }
            >
              <n.icon className="w-4 h-4 flex-shrink-0" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-green-700">
          <p className="text-xs text-green-300 px-3 truncate">{user?.name}</p>
        </div>
      </aside>
      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 flex items-center justify-between px-6">
          <span className="font-bold text-gray-800 text-sm">Hệ Thống Quản Trị Hoa Lạc Việc</span>
          <div className="flex items-center gap-3 ml-auto">
            <UserDropdown showWelcome={true} />
          </div>
        </header>
        <main className="p-6 lg:p-8 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
