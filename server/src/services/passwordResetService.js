import { createHash, randomBytes } from 'node:crypto';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;

export function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createResetToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) };
}

export function isPasswordEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_FROM_EMAIL && process.env.FRONTEND_URL);
}

export async function sendPasswordResetEmail(email, token) {
  const frontend = new URL(process.env.FRONTEND_URL);
  if (frontend.protocol !== 'https:' && frontend.hostname !== 'localhost' && frontend.hostname !== '127.0.0.1') {
    throw new Error('FRONTEND_URL phải dùng HTTPS trong môi trường triển khai.');
  }
  const link = new URL('/reset-password', frontend);
  link.searchParams.set('token', token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.PASSWORD_RESET_FROM_EMAIL,
      to: [email],
      subject: 'Đặt lại mật khẩu Hoa Lạc Việc',
      text: `Bạn đã yêu cầu đặt lại mật khẩu. Mở liên kết sau trong 30 phút: ${link.toString()}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Dịch vụ email trả về mã ${response.status}`);
}
