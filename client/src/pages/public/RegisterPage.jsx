import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Phone, User, Mail, Lock, Building, GraduationCap, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Input } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';

const ROLE_LABELS = { student: 'Sinh viên', employer: 'Chủ cửa hàng / Nhà tuyển dụng' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultRole = params.get('role') || 'student';

  const [role, setRole] = useState(defaultRole);

  useEffect(() => {
    const r = params.get('role');
    if (r === 'employer' || r === 'student') {
      setRole(r);
    }
  }, [params]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = role === 'employer' ? 'Vui lòng nhập tên cửa hàng.' : 'Vui lòng nhập họ và tên.';
    if (!email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email không hợp lệ.';
    if (!phone.trim()) e.phone = 'Vui lòng nhập số điện thoại để liên hệ.';
    else if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(phone.replace(/\s+/g, ''))) {
      e.phone = 'Số điện thoại không hợp lệ (10 chữ số).';
    }
    if (!password) e.password = 'Vui lòng nhập mật khẩu.';
    else if (password.length < 6) e.password = 'Mật khẩu tối thiểu 6 ký tự.';
    if (password !== confirm) e.confirm = 'Mật khẩu xác nhận không khớp.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const payload = {
        role,
        name,
        email,
        phone,
        password,
        ...(role === 'student' ? { university: extraInfo || 'Đại học FPT Hòa Lạc' } : { address: extraInfo || 'Tân Xã, Thạch Thất' })
      };
      await register(payload);
      navigate(role === 'student' ? '/student' : '/employer');
    } catch (err) {
      setErrors({ submit: err.message || 'Lỗi khi đăng ký tài khoản.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-cream to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block group mb-2">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-20 sm:h-24 w-auto mx-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>
          <h1 className="text-2xl font-bold text-green-dark">Đăng ký tài khoản</h1>
          <p className="text-text-muted text-xs mt-1">Kết nối việc làm & hỗ trợ sinh viên tại khu vực Hòa Lạc</p>
        </div>

        <div className="card shadow-modal bg-white rounded-3xl p-6 border border-green-100">
          {/* Role tabs */}
          <div className="flex gap-1 p-1 bg-green-50 rounded-2xl mb-5">
            {(['student', 'employer']).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setErrors({}); }}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                  role === r ? 'bg-white shadow-sm text-green-dark' : 'text-text-muted hover:text-green-dark'
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <Input
              id="reg-name"
              label={role === 'employer' ? 'Tên cửa hàng / Doanh nghiệp' : 'Họ và tên của bạn'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'employer' ? 'Ví dụ: Cà phê Highland FPT' : 'Nguyễn Văn A'}
              required
              error={errors.name}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="reg-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                required
                error={errors.email}
              />

              <Input
                id="reg-phone"
                label="Số điện thoại"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0981234567"
                required
                error={errors.phone}
              />
            </div>

            {role === 'student' ? (
              <Input
                id="reg-uni"
                label="Trường đang học / Ký túc xá"
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                placeholder="ĐH FPT, KTX ĐHQG, BKHN..."
              />
            ) : (
              <Input
                id="reg-addr"
                label="Địa chỉ cửa hàng tại Hòa Lạc"
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                placeholder="Thôn 3 Tân Xã, Cổng 1 FPT..."
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="reg-password"
                label="Mật khẩu"
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
                placeholder="Nhập lại"
                required
                error={errors.confirm}
              />
            </div>

            {errors.submit && (
              <p className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">{errors.submit}</p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
              Hoàn tất đăng ký
            </Button>
          </form>

          <p className="text-center text-xs text-text-muted mt-5">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-green-main font-bold hover:underline">Đăng nhập ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
