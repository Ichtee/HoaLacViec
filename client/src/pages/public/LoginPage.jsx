import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Input } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';
import { DEMO_CREDENTIALS } from '@/mocks/seed.js';

const ROLE_LABELS = { student: 'Sinh viên', employer: 'Nhà tuyển dụng', admin: 'Quản trị viên' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectAfterLogin = (sessionRole) => {
    if (from) { navigate(from, { replace: true }); return; }
    const dashboards = { student: '/student', employer: '/employer', admin: '/admin' };
    navigate(dashboards[sessionRole] || '/');
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Vui lòng nhập email.'); return; }
    setLoading(true);
    setError('');
    try {
      const session = await login(email.trim(), role);
      redirectAfterLogin(session.user.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo(cred) {
    setLoading(true);
    setError('');
    try {
      const session = await login(cred.email, cred.role);
      redirectAfterLogin(session.user.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const demoCreds = DEMO_CREDENTIALS.filter((c) => c.role === role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-light via-cream to-pink-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-main flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-green-dark">Đăng nhập</h1>
          <p className="text-text-muted text-sm mt-1">Demo — không cần mật khẩu thật</p>
        </div>

        <div className="card shadow-modal">
          {/* Role tabs */}
          <div className="flex gap-1 p-1 bg-green-50 rounded-2xl mb-5">
            {(['student', 'employer', 'admin']).map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setEmail(''); setError(''); }}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                  role === r ? 'bg-white shadow-sm text-green-dark' : 'text-text-muted hover:text-green-dark'
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Demo credentials */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Tài khoản demo</p>
            <div className="space-y-2">
              {demoCreds.map((c) => (
                <button
                  key={c.email}
                  onClick={() => handleDemo(c)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-green-100 hover:border-green-main hover:bg-green-50 transition-all text-left"
                  disabled={loading}
                >
                  <div className="w-9 h-9 rounded-xl bg-green-main text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-main">{c.name}</p>
                    <p className="text-xs text-text-muted">{c.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-green-100" />
            <span className="text-xs text-text-muted">hoặc nhập email</span>
            <div className="flex-1 h-px bg-green-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-email"
              label="Email demo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={demoCreds[0]?.email || 'email@demo.com'}
              required
              error={error}
            />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Đăng nhập
            </Button>
          </form>

          <div className="mt-4 p-3 bg-yellow-50 rounded-2xl text-xs text-yellow-800">
            ⚠ Đây là phiên demo. Không nhập mật khẩu hoặc thông tin thật.
          </div>

          <p className="text-center text-sm text-text-muted mt-5">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-green-main font-semibold hover:underline">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
