import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Leaf, LayoutDashboard, Briefcase, Users, Calendar,
  Building2, Menu, X, LogOut
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';

const EMPLOYER_NAV = [
  { to: '/employer', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/employer/profile', label: 'Hồ sơ cửa hàng', icon: Building2 },
  { to: '/employer/jobs', label: 'Tin tuyển dụng', icon: Briefcase },
  { to: '/employer/applications', label: 'Ứng viên', icon: Users },
  { to: '/employer/shifts', label: 'Quản lý ca', icon: Calendar },
];

function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
          isActive ? 'bg-pink-main text-white font-semibold shadow-sm' : 'text-text-muted hover:bg-pink-50 hover:text-pink-dark'
        )
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function EmployerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const sidebar = (
    <aside className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-green-50 flex items-center gap-2">
        <Link to="/" className="inline-flex items-center">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
        </Link>
      </div>
      <div className="px-4 py-3 bg-pink-50 mx-3 my-3 rounded-2xl border border-pink-100/50">
        <p className="text-[11px] font-semibold text-pink-dark">Nhà tuyển dụng</p>
        <p className="font-bold text-text-main text-sm truncate mt-0.5">{user?.name}</p>
      </div>
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {EMPLOYER_NAV.map((n) => <SidebarLink key={n.to} {...n} />)}
      </nav>
      <div className="p-3 border-t border-green-50">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 font-medium transition-colors">
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-cream flex">
      <div className="hidden lg:flex w-64 bg-white border-r border-green-50 flex-col fixed inset-y-0 left-0 z-30">{sidebar}</div>
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden shadow-modal">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-green-50"><X className="w-5 h-5" /></button>
            </div>
            {sidebar}
          </div>
        </>
      )}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <div className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-green-50 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-green-50"><Menu className="w-5 h-5" /></button>
          <span className="font-bold text-green-dark text-sm">Hoa Lạc Việc — Nhà tuyển dụng</span>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
