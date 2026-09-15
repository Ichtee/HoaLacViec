import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Input } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';

const ROLE_LABELS = { student: 'Sinh viên', employer: 'Nhà tuyển dụng' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultRole = params.get('role') || 'student';

  const [role, setRole] = useState(defaultRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Vui lòng nhập họ tên.';
    if (!email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email không hợp lệ.';
    if (!password) e.password = 'Vui lòng nhập mật khẩu demo.';
    else if (password.length < 6) e.password = 'Mật khẩu tối thiểu 6 ký tự.';
    if (password !== confirm) e.confirm = 'Mật khẩu xác nhận không khớp.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setErrors({});
    try {
      await register({ role, name, email });
      navigate(role === 'student' ? '/student' : '/employer');
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-light via-cream to-pink-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-main flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-green-dark">Tạo tài khoản demo</h1>
          <p className="text-text-muted text-sm mt-1">Không cần email thật — chỉ để trải nghiệm</p>
        </div>

        <div className="card shadow-modal">
          {/* Role tabs */}
          <div className="flex gap-1 p-1 bg-green-50 rounded-2xl mb-5">
            {(['student', 'employer']).map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setErrors({}); }}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                  role === r ? 'bg-white shadow-sm text-green-dark' : 'text-text-muted hover:text-green-dark'
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="reg-name"
              label={role === 'employer' ? 'Tên cửa hàng' : 'Họ và tên'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'employer' ? 'Café XYZ' : 'Nguyễn Văn A'}
              required
              error={errors.name}
            />
            <Input
              id="reg-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              error={errors.email}
            />
            <Input
              id="reg-password"
              label="Mật khẩu (demo — không lưu thật)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              required
              error={errors.password}
            />
            <Input
              id="reg-confirm"
              label="Xác nhận mật khẩu"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              required
              error={errors.confirm}
            />
            {errors.submit && <p className="error-msg">{errors.submit}</p>}

            <div className="p-3 bg-yellow-50 rounded-2xl text-xs text-yellow-800">
              ⚠ Đây là môi trường demo. Mật khẩu không được lưu trữ — bạn có thể nhập bất kỳ giá trị nào.
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Tạo tài khoản
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted mt-5">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-green-main font-semibold hover:underline">Đăng nhập</Link>
          </p>

          {role === 'admin' && (
            <p className="text-center text-xs text-text-light mt-2">
              Tài khoản Admin không đăng ký công khai. Dùng tài khoản demo tại trang đăng nhập.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
