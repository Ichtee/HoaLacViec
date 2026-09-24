import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Building2,
  GraduationCap,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';

export function UserDropdown({ showWelcome = true, className = '' }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isPending = user?.status === 'pending' || role === 'pending';

  const dashboardPath = isPending
    ? '/verify-account'
    : {
        student: '/student',
        employer: '/employer',
        admin: '/admin',
      }[role] || '/';

  const accountPath =
    role === 'student'
      ? '/student/account'
      : role === 'employer'
      ? '/employer/account'
      : role === 'admin'
      ? '/admin/account'
      : '/account/profile';

  const passwordPath =
    role === 'student'
      ? '/student/change-password'
      : role === 'employer'
      ? '/employer/change-password'
      : role === 'admin'
      ? '/admin/change-password'
      : '/account/change-password';

  function handleLogout() {
    setIsOpen(false);
    logout();
    navigate('/');
  }

  // Render Role Badge
  function renderRoleBadge() {
    if (isPending) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Chờ xét duyệt
        </span>
      );
    }
    if (role === 'student') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          <GraduationCap className="w-3 h-3" /> Sinh viên
        </span>
      );
    }
    if (role === 'employer') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
          <Building2 className="w-3 h-3" /> Nhà tuyển dụng
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
          <ShieldCheck className="w-3 h-3" /> Ban Quản Trị
        </span>
      );
    }
    return null;
  }

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl hover:bg-green-50/80 border border-transparent hover:border-green-100 transition-all group"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {showWelcome && (
          <span className="text-xs text-text-muted hidden sm:inline">
            Chào mừng, <strong className="text-text-main group-hover:text-green-dark transition-colors">{user?.name}</strong>
          </span>
        )}

        {/* User Avatar */}
        <div className="relative">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-xl object-cover ring-2 ring-green-100 group-hover:ring-green-300 transition-all shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-green-main text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          {isPending && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </div>

        <ChevronDown
          className={clsx(
            'w-3.5 h-3.5 text-text-muted transition-transform duration-200 group-hover:text-text-main',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-3xl shadow-modal border border-green-100 p-2 z-50 animate-scale-in origin-top-right">
          {/* User Info Header */}
          <div className="px-3.5 py-3 rounded-2xl bg-gradient-to-br from-green-50/70 to-cream border border-green-100/50 mb-1.5">
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-2xl object-cover ring-2 ring-white shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-green-main text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text-main text-sm truncate leading-snug">{user?.name}</p>
                <p className="text-[11px] text-text-muted truncate mt-0.5">{user?.email}</p>
                <div className="mt-1.5">{renderRoleBadge()}</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-0.5 text-xs font-medium text-text-main">
            {/* Account Info Page */}
            <Link
              to={accountPath}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-green-50 text-green-dark flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <span className="flex-1">Thông tin tài khoản</span>
            </Link>

            {/* Change Password Page */}
            <Link
              to={passwordPath}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <span className="flex-1">Đổi mật khẩu</span>
            </Link>

            {/* My Dashboard / Verification */}
            <Link
              to={dashboardPath}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 truncate">
                <span>{isPending ? 'Xác minh tài khoản' : 'Trang tổng quan'}</span>
              </div>
            </Link>

            {/* Role specific link: Student Profile */}
            {role === 'student' && !isPending && (
              <Link
                to="/student/profile"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="flex-1">Hồ sơ sinh viên</span>
              </Link>
            )}

            {/* Role specific link: Employer Profile */}
            {role === 'employer' && !isPending && (
              <Link
                to="/employer/profile"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="flex-1">Thông tin cửa hàng</span>
              </Link>
            )}

            <div className="border-t border-gray-100 my-1" />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-left font-semibold"
            >
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
