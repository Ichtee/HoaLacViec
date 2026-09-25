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
      await register(payload);
      navigate('/verify-account');
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
          <div className="mb-5 p-3 rounded-2xl bg-green-50/60 border border-green-100 text-center">
            <p className="text-xs font-semibold text-green-dark">
              Tạo tài khoản thành viên Hoa Lạc Việc
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Sau khi đăng ký, bạn có thể xác minh thẻ sinh viên để tìm việc ngay, hoặc nộp hồ sơ mở cửa hàng tuyển dụng.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
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
              <p className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">{errors.submit}</p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
              Tiếp tục & Xác minh tài khoản
            </Button>
            {slowNotice && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center mt-2.5 animate-fade-in">
                ⏳ Máy chủ Render đang thức dậy (mất ~30s sau thời gian nghỉ). Vui lòng đợi trong giây lát...
              </p>
            )}
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
