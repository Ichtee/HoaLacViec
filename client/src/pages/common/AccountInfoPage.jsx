import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Camera,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  GraduationCap,
  KeyRound,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { updateUserProfile, getMe } from '@/services';
import { Button } from '@/components/Button.jsx';
import { Input } from '@/components/Form.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AccountInfoPage() {
  const { user, role, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  // Sync data when user loads or updates
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Refresh user data from API on mount
  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await getMe();
        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
          setAvatar(data.avatar || '');
          updateUser(data);
        }
      } catch (err) {
        console.warn('Could not refresh user profile:', err);
      }
    }
    fetchUserData();
  }, []);

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError('Kích thước ảnh tối đa 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setAvatar(uploadEvent.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await updateUserProfile({
        name: name.trim(),
        phone: phone.trim(),
        avatar,
      });

      if (res.user) {
        updateUser(res.user);
      }
      setToast({
        type: 'success',
        message: 'Đã lưu thông tin tài khoản thành công!',
      });
    } catch (err) {
      setError(err.message || 'Lỗi khi cập nhật thông tin.');
    } finally {
      setLoading(false);
    }
  }

  const isPending = user?.status === 'pending' || role === 'pending';
  const passwordPath =
    role === 'student'
      ? '/student/change-password'
      : role === 'employer'
      ? '/employer/change-password'
      : role === 'admin'
      ? '/admin/change-password'
      : '/account/change-password';

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-green-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Thông tin cá nhân
            </span>
            {isPending && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Chờ xét duyệt
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">
            Cài đặt thông tin tài khoản
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Quản lý tên hiển thị, ảnh đại diện, số điện thoại và thông tin liên hệ của bạn.
          </p>
        </div>

        <Link
          to={passwordPath}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold text-xs transition-colors self-start sm:self-auto border border-amber-200/60"
        >
          <KeyRound className="w-4 h-4" /> Đổi mật khẩu <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-green-100 shadow-sm space-y-6">
        {/* Avatar Section */}
        <div className="border-b border-gray-100 pb-6">
          <label className="block text-xs font-bold text-text-main mb-3">Ảnh đại diện tài khoản</label>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-24 h-24 rounded-3xl object-cover ring-4 ring-green-100 shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-green-main text-white flex items-center justify-center font-bold text-3xl shadow-sm">
                  {name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 p-2 bg-white rounded-xl shadow-md border border-gray-200 text-gray-700 hover:text-green-dark hover:border-green-300 cursor-pointer transition-colors group-hover:scale-105">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <p className="text-xs font-semibold text-text-main">
                Ảnh hồ sơ hiển thị công khai trên hệ thống
              </p>
              <p className="text-[11px] text-text-muted">
                Hỗ trợ định dạng PNG, JPG (tối đa 3MB). Bấm vào biểu tượng máy ảnh để tải ảnh mới.
              </p>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar('')}
                  className="text-xs text-red-600 hover:underline font-medium inline-block pt-1"
                >
                  Xóa ảnh đại diện
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Basic Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            id="account-name"
            label="Họ và tên hiển thị"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn A"
            required
          />

          <Input
            id="account-phone"
            label="Số điện thoại liên hệ"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0981234567"
          />
        </div>

        {/* Email & System Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-text-main mb-1.5">Địa chỉ Email</label>
            <div className="relative">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-3.5 pr-28 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-green-700 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-main" /> Đã xác thực
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">Email được bảo mật và liên kết định danh.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-main mb-1.5">Vai trò tài khoản</label>
            <div className="px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                {role === 'student' && <GraduationCap className="w-4 h-4 text-emerald-600" />}
                {role === 'employer' && <Building2 className="w-4 h-4 text-purple-600" />}
                {role === 'admin' && <ShieldCheck className="w-4 h-4 text-gray-800" />}
                {isPending && <Clock className="w-4 h-4 text-amber-600" />}
                <span>
                  {role === 'student'
                    ? 'Sinh viên tìm việc'
                    : role === 'employer'
                    ? 'Nhà tuyển dụng / Cửa hàng'
                    : role === 'admin'
                    ? 'Quản trị viên hệ thống'
                    : 'Tài khoản chờ duyệt'}
                </span>
              </span>
              <span className="text-[11px] text-gray-400 font-normal">Hệ thống</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">Phân quyền do hệ thống Hoa Lạc Việc quản lý.</p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="px-8 shadow-sm"
          >
            Lưu thay đổi thông tin
          </Button>
        </div>
      </form>
    </div>
  );
}
