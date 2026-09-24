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
  Camera,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { updateUserProfile, changePassword } from '@/services';
import { Button } from './Button.jsx';
import { Input } from './Form.jsx';

export function UserDropdown({ showWelcome = true, className = '' }) {
  const { user, role, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Profile Modal State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Modal State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

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

  // Sync profile form when user changes or modal opens
  useEffect(() => {
    if (profileModalOpen) {
      setName(user?.name || '');
      setPhone(user?.phone || '');
      setAvatar(user?.avatar || '');
      setProfileError('');
      setProfileSuccess('');
    }
  }, [profileModalOpen, user]);

  // Reset password modal state on open
  useEffect(() => {
    if (passwordModalOpen) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassError('');
      setPassSuccess('');
    }
  }, [passwordModalOpen]);

  const isPending = user?.status === 'pending' || role === 'pending';
  const hasExistingPassword = user?.hasPassword !== false;

  const dashboardPath = isPending
    ? '/verify-account'
    : {
        student: '/student',
        employer: '/employer',
        admin: '/admin',
      }[role] || '/';

  function handleLogout() {
    setIsOpen(false);
    logout();
    navigate('/');
  }

  // Handle avatar file upload
  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setProfileError('Kích thước ảnh tối đa 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setAvatar(uploadEvent.target.result);
      setProfileError('');
    };
    reader.readAsDataURL(file);
  }

  // Submit profile update
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) {
      setProfileError('Vui lòng nhập họ và tên.');
      return;
    }

    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await updateUserProfile({
        name: name.trim(),
        phone: phone.trim(),
        avatar,
      });

      if (res.user) {
        updateUser(res.user);
      }
      setProfileSuccess('Đã cập nhật thông tin cá nhân thành công!');
      setTimeout(() => {
        setProfileModalOpen(false);
      }, 900);
    } catch (err) {
      setProfileError(err.message || 'Lỗi khi cập nhật thông tin.');
    } finally {
      setSavingProfile(false);
    }
  }

  // Submit password change
  async function handleSavePassword(e) {
    e.preventDefault();
    if (hasExistingPassword && !oldPassword) {
      setPassError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setSavingPass(true);
    setPassError('');
    setPassSuccess('');

    try {
      const res = await changePassword({
        oldPassword: hasExistingPassword ? oldPassword : '',
        newPassword,
      });

      setPassSuccess(res.message || 'Đổi mật khẩu thành công!');
      if (user) {
        updateUser({ ...user, hasPassword: true });
      }
      setTimeout(() => {
        setPasswordModalOpen(false);
      }, 1000);
    } catch (err) {
      setPassError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setSavingPass(false);
    }
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
    <>
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
              {/* Profile Details & Update */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-green-50 text-green-dark flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span>Thông tin tài khoản</span>
              </button>

              {/* Change Password */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setPasswordModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <span>Đổi mật khẩu</span>
              </button>

              {/* My Dashboard / Verification */}
              <Link
                to={dashboardPath}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 truncate">
                  <span>{isPending ? 'Xác minh tài khoản' : 'Trang tổng quan'}</span>
                </div>
              </Link>

              {/* Role specific quick links */}
              {role === 'student' && !isPending && (
                <Link
                  to="/student/profile"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span>Hồ sơ sinh viên</span>
                </Link>
              )}

              {role === 'employer' && !isPending && (
                <Link
                  to="/employer/profile"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-green-50 hover:text-green-dark transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span>Thông tin cửa hàng</span>
                </Link>
              )}

              <div className="border-t border-gray-100 my-1" />

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-left font-semibold"
              >
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Profile Update Modal                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setProfileModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <User className="w-5 h-5 text-green-dark" />
                  Thông tin cá nhân
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Xem và cập nhật thông tin hiển thị của tài khoản
                </p>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications */}
            {profileError && (
              <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 bg-green-50 rounded-2xl border border-green-200 text-xs text-green-800 font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-main" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Picker */}
              <div className="flex flex-col items-center justify-center gap-2 pb-1">
                <div className="relative group">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-20 h-20 rounded-3xl object-cover ring-4 ring-green-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-3xl bg-green-main text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                      {name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}

                  <label className="absolute -bottom-1 -right-1 p-2 bg-white rounded-xl shadow-md border border-gray-200 text-gray-700 hover:text-green-dark hover:border-green-300 cursor-pointer transition-colors group-hover:scale-110">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <span className="text-[11px] text-text-muted">Bấm vào biểu tượng máy ảnh để đổi avatar</span>
              </div>

              {/* Name */}
              <Input
                id="profile-name"
                label="Họ và tên"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ và tên..."
                required
              />

              {/* Email (Readonly) */}
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác thực
                  </span>
                </div>
              </div>

              {/* Phone */}
              <Input
                id="profile-phone"
                label="Số điện thoại"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ví dụ: 0981234567"
              />

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setProfileModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={savingProfile}
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Change Password Modal                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPasswordModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                  {hasExistingPassword ? 'Đổi mật khẩu tài khoản' : 'Thiết lập mật khẩu'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {hasExistingPassword
                    ? 'Nhập mật khẩu hiện tại và tạo mật khẩu mới an toàn'
                    : 'Thiết lập mật khẩu để có thể đăng nhập bằng email ngoài Google'}
                </p>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications */}
            {passError && (
              <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passError}</span>
              </div>
            )}
            {passSuccess && (
              <div className="p-3 bg-green-50 rounded-2xl border border-green-200 text-xs text-green-800 font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-main" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              {/* Old password if account has one */}
              {hasExistingPassword && (
                <div>
                  <label className="block text-xs font-bold text-text-main mb-1.5">
                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  Xác nhận lại mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={savingPass}
                >
                  {hasExistingPassword ? 'Cập nhật mật khẩu' : 'Lưu mật khẩu'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
