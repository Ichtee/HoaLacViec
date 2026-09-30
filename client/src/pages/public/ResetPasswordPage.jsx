import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiForgotPassword, apiResetPassword } from '@/services/api.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    if (token && (password.length < 6 || password.length > 32 || password !== confirmPassword)) {
      setError('Mật khẩu phải dài 6–32 ký tự và hai ô phải khớp nhau.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = token
        ? await apiResetPassword(token, password)
        : await apiForgotPassword(email.trim().toLowerCase());
      setMessage(result.message);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      <h1 className="text-xl font-bold text-text-main">{token ? 'Đặt mật khẩu mới' : 'Quên mật khẩu'}</h1>
      <p className="mt-2 text-sm text-text-muted">
        {token ? 'Nhập mật khẩu mới cho tài khoản của bạn.' : 'Nhập email tài khoản. Nếu tài khoản tồn tại, bạn sẽ nhận được liên kết có hiệu lực trong 30 phút.'}
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {token ? (
          <>
            <label className="block text-sm font-medium">Mật khẩu mới
              <input type="password" autoComplete="new-password" minLength={6} maxLength={32} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 p-3" />
            </label>
            <label className="block text-sm font-medium">Nhập lại mật khẩu
              <input type="password" autoComplete="new-password" minLength={6} maxLength={32} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 p-3" />
            </label>
          </>
        ) : (
          <label className="block text-sm font-medium">Email
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 p-3" />
          </label>
        )}
        <button type="submit" disabled={loading || Boolean(message && token)} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Đang xử lý...' : token ? 'Đặt lại mật khẩu' : 'Gửi liên kết'}
        </button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
      <Link to="/login" className="mt-5 block text-sm text-green-main hover:underline">Quay lại đăng nhập</Link>
    </div>
  );
}
