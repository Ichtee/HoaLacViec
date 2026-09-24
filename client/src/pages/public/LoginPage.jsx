
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Leaf, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Button } from '@/components/Button.jsx';

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slowNotice, setSlowNotice] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setSlowNotice(true), 3000);
    } else {
      setSlowNotice(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const redirectAfterLogin = (sessionRole) => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    const dashboards = {
      student: '/student',
      employer: '/employer',
      admin: '/admin',
    };
    navigate(dashboards[sessionRole] || '/');
  };

  async function handleGoogleSuccess(credentialResponse) {
    if (loading) return;
    const credential = credentialResponse?.credential;
    if (!credential) {
      setError('Không nhận được mã xác thực từ Google. Vui lòng thử lại.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await googleLogin(credential);
      redirectAfterLogin(session.user?.role);
    } catch (err) {
      setError(err.message || 'Đăng nhập bằng Google không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setError('Đăng nhập bằng Google thất bại hoặc đã bị đóng. Vui lòng thử lại.');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await login(email.trim().toLowerCase(), password);
      redirectAfterLogin(session.user?.role);
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-cream to-pink-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block group">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-20 sm:h-24 w-auto mx-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">
            Đăng nhập tài khoản
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            Chào mừng bạn đến với nền tảng việc làm & việc vặt sinh viên Hòa Lạc
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-green-50 shadow-modal space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-medium leading-relaxed">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          {googleClientId ? (
            <div className="flex flex-col items-center justify-center">
              <div className={`w-full flex justify-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                  shape="pill"
                  size="large"
                  locale="vi"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-700 text-center">
              ⚠️ Đăng nhập Google đang tạm tắt (chưa cấu hình VITE_GOOGLE_CLIENT_ID).
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-xs text-text-muted font-medium uppercase tracking-wider relative z-10">
              Hoặc
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-text-main mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@student.fpt.edu.vn hoặc email của bạn"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all placeholder-gray-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-text-main">
                  Mật khẩu
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Vui lòng liên hệ bộ phận hỗ trợ qua email hotro@hoalacviec.vn để được hỗ trợ đặt lại mật khẩu.');
                  }}
                  className="text-[11px] font-medium text-green-main hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full justify-center shadow-sm"
              >
                Đăng nhập <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              {slowNotice && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center mt-2.5 animate-fade-in">
                  ⏳ Máy chủ Render đang thức dậy (mất ~30s sau thời gian nghỉ). Vui lòng đợi trong giây lát...
                </p>
              )}
            </div>
          </form>

          {/* Register Link */}
          <div className="pt-2 text-center">
            <p className="text-xs text-text-muted">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-green-main font-bold hover:underline">
                Đăng ký tài khoản mới ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
