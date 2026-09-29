import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Input } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
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

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Vui lòng nhập họ và tên của bạn.';
    if (!email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email không hợp lệ.';
    if (!phone.trim()) e.phone = 'Vui lòng nhập số điện thoại để liên hệ.';
    else if (!/^(0|\+84)[0-9]{9}$/.test(phone.replace(/\s+/g, ''))) {
      e.phone = 'Số điện thoại không hợp lệ (10 chữ số).';
    }
    if (!password) e.password = 'Vui lòng nhập mật khẩu.';
    else if (password.length < 6) e.password = 'Mật khẩu phải có tối thiểu 6 ký tự.';
    else if (password.length > 32) e.password = 'Mật khẩu không được vượt quá 32 ký tự.';
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
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      };
      const session = await register(payload);
      const registeredUser = session?.user;

      if (registeredUser?.status === 'pending' || registeredUser?.role === 'pending') {
        navigate('/verify-account');
        return;
      }

      const dashboards = {
        student: '/student',
        employer: '/employer',
        admin: '/admin',
      };
      navigate(dashboards[registeredUser?.role] || '/student');
    } catch (err) {
      setErrors({ submit: err.message || 'Lỗi khi đăng ký tài khoản.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-fade-in">
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-block py-1">
            <img
              src="/logo.png"
              alt="Hoa Lạc Việc"
              className="h-12 w-auto mx-auto object-contain"
            />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
            Đăng ký tài khoản
          </h1>
          <p className="text-text-muted text-xs">
            Nền tảng việc làm theo ca cho sinh viên khu vực Hòa Lạc
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
            <p className="text-xs font-semibold text-text-main">
              Tạo tài khoản Hoa Lạc Việc
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Sau khi đăng ký, bạn có thể hoàn tất thông tin để tìm việc hoặc mở tài khoản tuyển dụng.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <Input
              id="reg-name"
              label="Họ và tên của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="reg-password"
                label="Mật khẩu"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Từ 6 đến 32 ký tự"
                minLength={6}
                maxLength={32}
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
                minLength={6}
                maxLength={32}
                required
                error={errors.confirm}
              />
            </div>

            {errors.submit && (
              <p className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{errors.submit}</p>
            )}

            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full mt-2 justify-center">
              Tiếp tục & Xác minh tài khoản
            </Button>
            {slowNotice && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center mt-2 animate-fade-in">
                Máy chủ đang khởi động lại. Vui lòng đợi trong giây lát...
              </p>
            )}
          </form>

          <p className="text-center text-xs text-text-muted pt-2 border-t border-gray-100">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-green-dark font-semibold hover:underline">Đăng nhập ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
