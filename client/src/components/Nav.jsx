import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Leaf, Menu, X, ChevronDown, LogOut, User, Settings, RotateCcw, Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { resetDemoData, dataMode } from '@/services';

const NAV_PUBLIC = [
  { to: '/jobs', label: 'Tìm Việc' },
  { to: '/about', label: 'Về Chúng Tôi' },
];

export function Navbar({ onReset }) {
  const { user, role, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
    setDropOpen(false);
  }

  function handleReset() {
    if (confirm('Khôi phục dữ liệu demo về trạng thái ban đầu?')) {
      resetDemoData();
      window.location.reload();
    }
  }

  const dashboardPath = {
    student: '/student',
    employer: '/employer',
    admin: '/admin',
  }[role] || '/';

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-green-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-green-main flex items-center justify-center group-hover:bg-green-dark transition-colors">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-green-dark hidden sm:block">Hoa Lạc Việc</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_PUBLIC.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  location.pathname.startsWith(n.to) ? 'bg-green-light text-green-dark' : 'text-text-muted hover:text-green-dark hover:bg-green-50'
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Demo mode badge */}
            {dataMode === 'mock' && (
              <span className="hidden sm:inline-flex badge badge-yellow text-xs">Demo</span>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setDropOpen(!dropOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors"
                  aria-expanded={dropOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-xl bg-green-main flex items-center justify-center text-white font-bold text-sm">
                    {user?.name?.[0] || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-text-main max-w-[120px] truncate">{user?.name}</span>
                  <ChevronDown className={clsx('w-4 h-4 text-text-muted transition-transform', dropOpen && 'rotate-180')} />
                </button>

                {dropOpen && (
                  <>
                    <div className="fixed inset-0" onClick={() => setDropOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-modal border border-green-50 p-2 z-50 animate-scale-in">
                      <div className="px-3 py-2 mb-1">
                        <p className="font-semibold text-text-main text-sm">{user?.name}</p>
                        <p className="text-xs text-text-muted">{user?.email}</p>
                      </div>
                      <div className="border-t border-green-50 my-1" />
                      <Link to={dashboardPath} onClick={() => setDropOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-green-50 text-sm text-text-main transition-colors">
                        <User className="w-4 h-4" /> Trang của tôi
                      </Link>
                      <button onClick={handleReset} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-yellow-50 text-sm text-yellow-700 transition-colors">
                        <RotateCcw className="w-4 h-4" /> Khôi phục demo
                      </button>
                      <div className="border-t border-green-50 my-1" />
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 text-sm text-red-500 transition-colors">
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost btn btn-sm hidden sm:inline-flex">Đăng nhập</Link>
                <Link to="/register" className="btn-primary btn btn-sm">Đăng ký</Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-green-50 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-green-50 py-3 flex flex-col gap-1">
            {NAV_PUBLIC.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:bg-green-50 hover:text-green-dark"
              >
                {n.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm font-medium text-text-muted">
                Đăng nhập
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-green-dark text-white mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-main flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">Hoa Lạc Việc</span>
            </div>
            <p className="text-green-200 text-sm leading-relaxed">
              Nền tảng tuyển dụng siêu địa phương, kết nối sinh viên Hòa Lạc với việc làm phù hợp lịch học.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Sinh viên</h4>
            <ul className="space-y-2 text-green-200 text-sm">
              <li><Link to="/jobs" className="hover:text-white transition-colors">Tìm việc</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Tạo hồ sơ</Link></li>
              <li><Link to="/student" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Nhà tuyển dụng</h4>
            <ul className="space-y-2 text-green-200 text-sm">
              <li><Link to="/employer" className="hover:text-white transition-colors">Đăng tin</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Đăng ký cửa hàng</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-green-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-green-300 text-sm">© 2026 Hoa Lạc Việc — Dữ liệu demo, không phục vụ mục đích thương mại</p>
          <span className="badge badge-yellow text-xs">v0.1.0 Demo</span>
        </div>
      </div>
    </footer>
  );
}
