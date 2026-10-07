import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { resolveApiBase } from '../src/services/apiBase.js';
import { seedUser, PASSWORD } from './helpers.js';

// Trùng với JWT_SECRET mặc định của test server (server/test/e2e/testServer.mjs)
const E2E_SECRET = 'e2e-secret-not-for-production';

function signExpiredToken(user) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ id: user.id, role: user.role, email: user.email, name: user.name, tokenVersion: 0, iat: now - 3600, exp: now - 60 });
  const signature = crypto.createHmac('sha256', E2E_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function loadSessionWithExpiredToken(page, user) {
  const token = signExpiredToken(user);
  const session = JSON.stringify({ user, profileId: user.profileId || null });
  await page.addInitScript(([t, s]) => {
    if (!sessionStorage.getItem('e2e_seeded')) {
      localStorage.setItem('token', t);
      localStorage.setItem('hlv_auth_session', s);
      sessionStorage.setItem('hlv_auth_session', s);
      sessionStorage.setItem('e2e_seeded', '1');
    }
  }, [token, session]);
  return token;
}

test('mã truy cập hết hạn được gia hạn tự động bằng cookie (frontend gọi API cùng origin)', async ({ page }) => {
  const seeded = await seedUser('student', 'Sinh Viên Gia Hạn');
  // Đăng nhập qua đúng origin của frontend để trình duyệt lưu cookie phiên như ngoài thật
  const login = await page.request.post('/api/auth/login', { data: { email: seeded.email, password: PASSWORD } });
  expect(login.status()).toBe(200);
  const { user } = await login.json();
  const expired = await loadSessionWithExpiredToken(page, user);

  await page.goto('/student/messages');
  await expect(page.getByRole('heading', { name: 'Tin nhắn' })).toBeVisible();
  await expect(page).toHaveURL(/\/student\/messages$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBe(expired);
});

test('không gia hạn được thì đăng xuất và về trang đăng nhập kèm thông báo', async ({ page }) => {
  const seeded = await seedUser('student', 'Sinh Viên Hết Phiên');
  const login = await page.request.post('/api/auth/login', { data: { email: seeded.email, password: PASSWORD } });
  const { user } = await login.json();
  await page.context().clearCookies(); // mất cookie phiên -> không gia hạn được
  await loadSessionWithExpiredToken(page, user);

  await page.goto('/student/messages');
  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(page.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('bản production gọi API cùng origin kể cả khi cấu hình VITE_API_URL trỏ domain khác', () => {
  // Gọi thẳng domain khác (vd. onrender.com) làm cookie SameSite bị chặn -> mất phiên sau 15 phút
  expect(resolveApiBase({ PROD: true, VITE_API_URL: 'https://hoalacviec.onrender.com' })).toBe('/api');
  expect(resolveApiBase({ PROD: true, VITE_API_URL: '/api' })).toBe('/api');
  expect(resolveApiBase({ PROD: true, VITE_API_URL: 'https://api.example.com', VITE_API_CROSS_SITE: 'true' })).toBe('https://api.example.com/api');
  expect(resolveApiBase({ PROD: false, VITE_API_URL: 'http://localhost:5000' })).toBe('http://localhost:5000/api');
  expect(resolveApiBase({})).toBe('/api');
});
