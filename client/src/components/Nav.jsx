import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { NotificationDropdown } from './NotificationDropdown.jsx';
import { UserDropdown } from './UserDropdown.jsx';

const NAV_PUBLIC = [
  { to: '/jobs', label: 'Tìm Việc' },
  { to: '/tasks', label: 'Chợ Việc Vặt' },
  { to: '/blogs', label: 'Cẩm Nang' },
];

export function Navbar({ hideNavLinks = false }) {
  const { user, role, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isPending = user?.status === 'pending' || role === 'pending';
  const isDetailPage = /^\/(?:student\/)?jobs\/[^/]+$/.test(location.pathname) || /^\/blogs\/[^/]+$/.test(location.pathname);
  const shouldHideLinks = hideNavLinks || isDetailPage;

  const dashboardPath = isPending
    ? '/verify-account'
    : {
        student: '/student',
        employer: '/employer',
        admin: '/admin',
      }[role] || '/';

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Logo - Stable, no hover scale */}
          <Link to={isAuthenticated ? dashboardPath : '/'} className="flex items-center gap-2 py-1">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Desktop nav - Clean text links with subtle indicator */}
          {!isPending && !shouldHideLinks && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_PUBLIC.map((n) => {
                const isActive = location.pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'text-green-dark font-semibold bg-gray-100/80'
                        : 'text-text-muted hover:text-text-main hover:bg-gray-50'
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {!isPending && <NotificationDropdown />}
                <UserDropdown showWelcome={false} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost btn btn-sm hidden sm:inline-flex">
                  Đăng nhập
                </Link>
                <Link to="/register" className="btn-primary btn btn-sm">
                  Đăng ký
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            {!isPending && (!shouldHideLinks || !isAuthenticated) && (
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {!isPending && menuOpen && (!shouldHideLinks || !isAuthenticated) && (
          <div className="md:hidden border-t border-gray-200 py-2.5 flex flex-col gap-1">
            {!shouldHideLinks && NAV_PUBLIC.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith(n.to)
                    ? 'text-green-dark font-semibold bg-gray-100'
                    : 'text-text-muted hover:bg-gray-50 hover:text-text-main'
                )}
              >
                {n.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <div className="pt-2 border-t border-gray-200 flex flex-col gap-2 px-1">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="px-3 py-2 text-sm font-medium text-text-muted">
                  Đăng nhập
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary btn btn-sm text-center">
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
    <footer className="bg-white border-t border-gray-200 mt-20 text-text-main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="Hoa Lạc Việc" className="h-9 w-auto object-contain" />
            </div>
            <p className="text-text-muted text-xs leading-relaxed max-w-sm">
              Bảng tin việc làm theo ca và việc vặt sinh viên tại Khu Công nghệ cao Hòa Lạc. Hỗ trợ sinh viên FPT, ĐHQG tìm việc gần trường, đúng lịch rảnh.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-text-main text-xs uppercase tracking-wider mb-3">Dành cho Sinh viên</h4>
            <ul className="space-y-2 text-text-muted text-xs">
              <li><Link to="/jobs" className="hover:text-green-dark transition-colors">Tìm việc làm gần bạn</Link></li>
              <li><Link to="/tasks" className="hover:text-green-dark transition-colors">Chợ việc vặt sinh viên</Link></li>
              <li><Link to="/blogs" className="hover:text-green-dark transition-colors">Cẩm nang & Kinh nghiệm</Link></li>
              <li><Link to="/register" className="hover:text-green-dark transition-colors">Đăng ký tài khoản</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-text-main text-xs uppercase tracking-wider mb-3">Dành cho Cửa hàng</h4>
            <ul className="space-y-2 text-text-muted text-xs">
              <li><Link to="/employer" className="hover:text-green-dark transition-colors">Đăng tin tuyển ca</Link></li>
              <li><Link to="/register?role=employer" className="hover:text-green-dark transition-colors">Đăng ký tài khoản tuyển dụng</Link></li>
              <li><Link to="/login" className="hover:text-green-dark transition-colors">Quản lý ca & nhân viên</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-light">
          <p>© 2026 Hoa Lạc Việc — Bảng tin việc làm sinh viên Hòa Lạc</p>
          <span>Khu CNC Hòa Lạc, Thạch Thất, Hà Nội</span>
        </div>
      </div>
    </footer>
  );
}
