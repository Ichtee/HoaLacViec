import { Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, ShieldCheck, Briefcase, Flag, Users, BookOpen, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';
import { SidebarNav } from '@/components/NavMenu.jsx';

const ADMIN_NAV_GROUPS = [
  { items: [{ to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true }] },
  {
    title: 'Kiểm duyệt',
    items: [
      { to: '/admin/verification', label: 'Xác thực nhà tuyển dụng', icon: ShieldCheck },
      { to: '/admin/jobs', label: 'Kiểm duyệt tin', icon: Briefcase },
      { to: '/admin/reports', label: 'Báo cáo vi phạm', icon: Flag },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/admin/users', label: 'Tài khoản', icon: Users },
      { to: '/admin/blogs', label: 'Quản lý Blog', icon: BookOpen },
    ],
  },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebar = (
    <aside className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-green-50 flex items-center justify-center sm:justify-start">
        <Link to="/admin" className="inline-flex items-center group">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
      </div>
      <div className="px-4 py-3 bg-green-50 mx-3 my-3 rounded-2xl border border-green-100/50">
        <p className="text-[11px] font-semibold text-green-dark">Quản trị viên</p>
        <p className="font-bold text-text-main text-sm truncate mt-0.5">{user?.name}</p>
      </div>
      <SidebarNav groups={ADMIN_NAV_GROUPS} onNavigate={() => setSidebarOpen(false)} />
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
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-green-50" aria-label="Đóng menu"><X className="w-5 h-5" /></button>
            </div>
            {sidebar}
          </div>
        </>
      )}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-green-50 h-16 flex items-center justify-between px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-green-50" aria-label="Mở menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <UserDropdown showWelcome={true} />
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
