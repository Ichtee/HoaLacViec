
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

  const redirectAfterLogin = (sessionUser) => {
    if (sessionUser?.status === 'pending' || sessionUser?.role === 'pending') {
      navigate('/verify-account', { replace: true });
      return;
    }
    const dashboards = {
      student: '/student',
      employer: '/employer',
      admin: '/admin',
    };
    if (from && from !== '/' && from !== '/login' && from !== '/register') {
      navigate(from, { replace: true });
      return;
    }
    navigate(dashboards[sessionUser?.role] || '/student', { replace: true });
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
      redirectAfterLogin(session.user);
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
    if (password.length < 6) {
      setError('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password.length > 32) {
      setError('Mật khẩu không được vượt quá 32 ký tự.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await login(email.trim().toLowerCase(), password);
      redirectAfterLogin(session.user);
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-5 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-block py-1">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-12 w-auto mx-auto object-contain"
            />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
            Đăng nhập tài khoản
          </h1>
          <p className="text-xs text-text-muted">
            Nền tảng việc làm theo ca cho sinh viên khu vực Hòa Lạc
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
          {error && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700 font-medium leading-relaxed">
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
                  shape="rectangular"
                  size="medium"
                  locale="vi"
                />
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 text-center">
              Đăng nhập Google đang tạm tắt (chưa cấu hình VITE_GOOGLE_CLIENT_ID).
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-2.5 text-[11px] text-text-muted font-medium uppercase tracking-wider relative z-10">
              Hoặc
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@student.fpt.edu.vn"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-green-main focus:ring-1 focus:ring-green-main text-text-main placeholder-gray-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-main">
                  Mật khẩu
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Vui lòng liên hệ bộ phận hỗ trợ qua email hotro@hoalacviec.vn để được hỗ trợ đặt lại mật khẩu.');
                  }}
                  className="text-[11px] text-green-dark hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={32}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-green-main focus:ring-1 focus:ring-green-main text-text-main placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                className="w-full justify-center"
              >
                Đăng nhập
              </Button>
              {slowNotice && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center mt-2 animate-fade-in">
                  Máy chủ đang khởi động lại. Vui lòng đợi trong giây lát...
                </p>
              )}
            </div>
          </form>

          {/* Register Link */}
          <div className="pt-2 text-center border-t border-gray-100">
            <p className="text-xs text-text-muted">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-green-dark font-semibold hover:underline">
                Đăng ký tài khoản mới
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
