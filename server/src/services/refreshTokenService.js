import crypto from 'crypto';
import mongoose from 'mongoose';
import { RefreshToken } from '../models/RefreshToken.js';

export const REFRESH_COOKIE = 'hlv_rt';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_PATH = '/api/auth';

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key) cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: COOKIE_PATH,
    maxAge: REFRESH_TTL_MS,
  };
}

/**
 * Tạo refresh token mới và gắn vào cookie httpOnly.
 * Best-effort: nếu không ghi được (ví dụ DB chưa sẵn sàng) thì đăng nhập vẫn thành công
 * với access token ngắn hạn, nhưng ghi cảnh báo để người vận hành biết.
 */
export async function issueRefreshToken(user, req, res) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const token = crypto.randomBytes(48).toString('base64url');
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hash(token),
      tokenVersion: user.tokenVersion || 0,
      userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 300),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    res.cookie(REFRESH_COOKIE, token, cookieOptions());
    return token;
  } catch (err) {
    console.warn('[auth] không tạo được refresh token:', err.message);
    return null;
  }
}

/**
 * Đổi refresh token (dùng một lần) lấy quyền tạo phiên mới. Trả về userId hoặc null.
 * findOneAndDelete đảm bảo hai yêu cầu đồng thời không cùng dùng được một token.
 */
export async function consumeRefreshToken(req) {
  const token = parseCookies(req.headers?.cookie)[REFRESH_COOKIE];
  if (!token) return null;
  const record = await RefreshToken.findOneAndDelete({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  return record ? { userId: record.userId, tokenVersion: record.tokenVersion || 0 } : null;
}

export async function revokeRefreshToken(req, res) {
  const token = parseCookies(req.headers?.cookie)[REFRESH_COOKIE];
  if (token) await RefreshToken.deleteOne({ tokenHash: hash(token) });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

/** Thu hồi mọi phiên của người dùng (đổi/đặt lại mật khẩu). */
export async function revokeAllRefreshTokens(userId) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    await RefreshToken.deleteMany({ userId });
  } catch (err) {
    console.warn('[auth] không thu hồi được refresh token:', err.message);
  }
}
