
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Leaf, Menu, X, ChevronDown, LogOut, User, Settings, Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { NotificationDropdown } from './NotificationDropdown.jsx';

const NAV_PUBLIC = [
  { to: '/jobs', label: 'Tìm Việc' },
  { to: '/tasks', label: 'Chợ Việc Vặt' },
  { to: '/blogs', label: 'Blog Cẩm Nang' },
];

export function Navbar() {
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

  const isPending = user?.status === 'pending' || role === 'pending';
  const dashboardPath = isPending
    ? '/verify-account'
    : {
        student: '/student',
        employer: '/employer',
        admin: '/admin',
      }[role] || '/';

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-green-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={isPending ? '/verify-account' : '/'} className="flex items-center gap-2 group py-1">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop nav (Ẩn khi tài khoản đang pending) */}
          {!isPending && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_PUBLIC.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    location.pathname.startsWith(n.to) ? 'bg-green-light text-green-dark font-semibold' : 'text-text-muted hover:text-green-dark hover:bg-green-50'
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {!isPending && <NotificationDropdown />}
                <div className="relative">
                <button
                  onClick={() => setDropOpen(!dropOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors"
                  aria-expanded={dropOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-xl bg-green-main flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {user?.name?.[0] || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-text-main max-w-[140px] truncate">{user?.name}</span>
                  <ChevronDown className={clsx('w-4 h-4 text-text-muted transition-transform', dropOpen && 'rotate-180')} />
                </button>

                {dropOpen && (
                  <>
                    <div className="fixed inset-0" onClick={() => setDropOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-modal border border-green-50 p-2 z-50 animate-scale-in">
                      <div className="px-3 py-2 mb-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-text-main text-sm truncate">{user?.name}</p>
                          {isPending && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex-shrink-0">
                              Chờ duyệt
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">{user?.email}</p>
                      </div>
                      <div className="border-t border-green-50 my-1" />
                      <Link to={dashboardPath} onClick={() => setDropOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-green-50 text-sm text-text-main transition-colors">
                        <User className="w-4 h-4 text-green-dark" />
                        {isPending ? 'Xác minh tài khoản' : 'Trang của tôi'}
                      </Link>
                      <div className="border-t border-green-50 my-1" />
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 text-sm text-red-500 transition-colors">
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost btn btn-sm hidden sm:inline-flex">Đăng nhập</Link>
                <Link to="/register" className="btn-primary btn btn-sm">Đăng ký</Link>
              </div>
            )}

            {/* Mobile menu toggle (Ẩn khi pending vì chỉ xem verify) */}
            {!isPending && (
              <button
                className="md:hidden p-2 rounded-xl hover:bg-green-50 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {!isPending && menuOpen && (
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
              <div className="pt-2 border-t border-green-50 flex flex-col gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="px-4 py-2 text-sm font-medium text-text-muted">
                  Đăng nhập
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary btn btn-sm mx-4 text-center">
                  Đăng ký tài khoản
                </Link>
              </div>
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
              <div className="bg-white px-3.5 py-2 rounded-2xl shadow-sm inline-flex items-center">
                <img src="/logo.png" alt="Hoa Lạc Việc" className="h-11 w-auto object-contain" />
              </div>
            </div>
            <p className="text-green-200 text-sm leading-relaxed">
              Nền tảng việc làm & hỗ trợ sinh viên tại Khu Công nghệ cao Hòa Lạc. Kết nối việc làm part-time, ca linh hoạt và dịch vụ việc vặt sinh viên.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Dành cho Sinh viên</h4>
            <ul className="space-y-2 text-green-200 text-sm">
              <li><Link to="/jobs" className="hover:text-white transition-colors">Tìm việc làm gần bạn</Link></li>
              <li><Link to="/tasks" className="hover:text-white transition-colors">Chợ việc vặt sinh viên</Link></li>
              <li><Link to="/blogs" className="hover:text-white transition-colors">Cẩm nang & Cảnh giác</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Đăng ký tài khoản</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Dành cho Cửa hàng</h4>
            <ul className="space-y-2 text-green-200 text-sm">
              <li><Link to="/employer" className="hover:text-white transition-colors">Đăng tin tuyển ca</Link></li>
              <li><Link to="/register?role=employer" className="hover:text-white transition-colors">Đăng ký đối tác cửa hàng</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Quản lý tuyển dụng</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-green-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-green-300 text-sm">© 2026 Hoa Lạc Việc — Nền tảng việc làm & Hỗ trợ sinh viên Hòa Lạc</p>
          <span className="text-xs text-green-300 font-medium">Phiên bản chính thức v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
