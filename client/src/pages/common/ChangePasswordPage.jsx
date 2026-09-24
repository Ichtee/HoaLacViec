import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { changePassword } from '@/services';
import { Button } from '@/components/Button.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function ChangePasswordPage() {
  const { user, role, updateUser } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const hasExistingPassword = user?.hasPassword !== false;

  const accountPath =
    role === 'student'
      ? '/student/account'
      : role === 'employer'
      ? '/employer/account'
      : role === 'admin'
      ? '/admin/account'
      : '/account/profile';

  async function handleSubmit(e) {
    e.preventDefault();

    if (hasExistingPassword && !oldPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await changePassword({
        oldPassword: hasExistingPassword ? oldPassword : '',
        newPassword,
      });

      setToast({
        type: 'success',
        message: res.message || 'Cập nhật mật khẩu thành công!',
      });

      if (user) {
        updateUser({ ...user, hasPassword: true });
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-green-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> Bảo mật tài khoản
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">
            {hasExistingPassword ? 'Đổi mật khẩu tài khoản' : 'Thiết lập mật khẩu mới'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {hasExistingPassword
              ? 'Tạo mật khẩu an toàn kết hợp chữ, số và ký tự để bảo vệ tài khoản.'
              : 'Thiết lập mật khẩu để bạn có thể đăng nhập bằng email ngoài tài khoản Google.'}
          </p>
        </div>

        <Link
          to={accountPath}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gray-50 text-gray-700 hover:bg-gray-100 font-semibold text-xs transition-colors self-start sm:self-auto border border-gray-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Thông tin tài khoản
        </Link>
      </div>

      {/* Google User Note */}
      {!hasExistingPassword && (
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-800 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Tài khoản đăng nhập Google</p>
            <p className="text-blue-700 leading-relaxed">
              Bạn hiện đang đăng nhập qua Google. Bạn có thể thiết lập mật khẩu ngay tại đây để có thể đăng nhập bằng cả 2 cách (qua Google hoặc bằng Email + Mật khẩu).
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Password Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-green-100 shadow-sm space-y-5">
        {/* Old password if existing */}
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
                className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label="Toggle password visibility"
              >
                {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* New password */}
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
              className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main transition-all"
            />
            <button
              type="button"
              onClick={() => setShowNewPass(!showNewPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Toggle password visibility"
            >
              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-bold text-text-main mb-1.5">
            Xác nhận mật khẩu mới <span className="text-red-500">*</span>
          </label>
          <input
            type={showNewPass ? 'text' : 'password'}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới..."
            className="w-full px-3.5 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main transition-all"
          />
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="px-8 shadow-sm"
          >
            {hasExistingPassword ? 'Cập nhật mật khẩu' : 'Lưu mật khẩu mới'}
          </Button>
        </div>
      </form>
    </div>
  );
}
