import { Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Briefcase, Users, Calendar,
  X, UserCheck, Zap, MessageCircle, Repeat,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useNavBadges } from '@/hooks/useNavBadges.js';
import { NotificationDropdown } from '@/components/NotificationDropdown.jsx';
import { UserDropdown } from '@/components/UserDropdown.jsx';
import { SidebarNav, BottomNav } from '@/components/NavMenu.jsx';

const EMPLOYER_NAV_GROUPS = [
  { items: [{ to: '/employer', label: 'Tổng quan', icon: LayoutDashboard, end: true }] },
  {
    title: 'Tuyển dụng',
    items: [
      { to: '/employer/jobs', label: 'Tin tuyển dụng', icon: Briefcase },
      { to: '/employer/applications', label: 'Ứng viên', icon: Users },
      { to: '/employer/quick-shifts', label: 'Tuyển nhanh', icon: Zap },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      { to: '/employer/employees', label: 'Nhân viên', icon: UserCheck },
      { to: '/employer/shifts', label: 'Quản lý ca', icon: Calendar },
      { to: '/employer/swaps', label: 'Đổi ca', icon: Repeat },
    ],
  },
  {
    title: 'Liên lạc',
    items: [{ to: '/employer/messages', label: 'Tin nhắn', icon: MessageCircle, badgeKey: 'messages' }],
  },
];

const EMPLOYER_BOTTOM_NAV = [
  { to: '/employer', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/employer/applications', label: 'Ứng viên', icon: Users },
  { to: '/employer/shifts', label: 'Quản lý ca', icon: Calendar },
  { to: '/employer/messages', label: 'Tin nhắn', icon: MessageCircle, badgeKey: 'messages' },
];

export default function EmployerLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const badges = useNavBadges(Boolean(user));

  const sidebar = (
    <aside className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-green-50 flex items-center justify-center sm:justify-start">
        <Link to="/employer" className="inline-flex items-center group">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
      </div>
      <div className="px-4 py-3 bg-green-50 mx-3 my-3 rounded-2xl border border-green-100/50">
        <p className="text-[11px] font-semibold text-green-dark">Nhà tuyển dụng</p>
        <p className="font-bold text-text-main text-sm truncate mt-0.5">{user?.name}</p>
      </div>
      <SidebarNav groups={EMPLOYER_NAV_GROUPS} badges={badges} onNavigate={() => setSidebarOpen(false)} />
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
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-green-50 h-16 flex items-center justify-between px-4 sm:px-6">
          <Link to="/employer" className="lg:hidden inline-flex items-center" aria-label="Trang chủ">
            <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationDropdown />
            <UserDropdown showWelcome={true} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto"><Outlet /></main>
      </div>

      <BottomNav items={EMPLOYER_BOTTOM_NAV} badges={badges} onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
