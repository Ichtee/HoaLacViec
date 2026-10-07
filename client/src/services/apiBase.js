/**
 * Địa chỉ gốc của API.
 * - Bản production: luôn gọi '/api' trên chính domain frontend (vercel.json rewrite sang Render).
 *   Gọi thẳng domain khác làm cookie phiên (SameSite) bị trình duyệt chặn -> mất đăng nhập sau 15 phút.
 *   Chỉ dùng VITE_API_URL tuyệt đối khi đặt rõ VITE_API_CROSS_SITE=true (và server đã cấu hình cookie phù hợp).
 * - Bản dev: dùng VITE_API_URL nếu có, mặc định '/api' (Vite proxy).
 */
export function resolveApiBase({ PROD = false, VITE_API_URL = '', VITE_API_CROSS_SITE = '' } = {}) {
  const raw = String(VITE_API_URL || '').replace(/\/$/, '');
  const isAbsolute = /^https?:\/\//i.test(raw);
  if (PROD && isAbsolute && String(VITE_API_CROSS_SITE) !== 'true') return '/api';
  if (!raw) return '/api';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}
