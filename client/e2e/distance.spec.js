import { test, expect } from '@playwright/test';
import { seedUser, seedJob, signIn, apiCall, apiLogin } from './helpers.js';

// Người dùng ở trung tâm Hòa Lạc; quán cách đúng ~1.0 km về phía bắc (0.009° vĩ độ)
const USER = { latitude: 21.0128, longitude: 105.5255 };
const SHOP = { lat: 21.0218, lng: 105.5255 };

const pinned = (point) => ({
  location: point,
  geoPoint: { type: 'Point', coordinates: [point.lng, point.lat] },
  locationStatus: 'confirmed',
  locationSource: 'map_pin',
});

async function gpsContext(browser, accuracy = 20) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    geolocation: { ...USER, accuracy },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('hlv_location_banner_dismissed', '1'); } catch { /* */ } });
  return ctx;
}

test('danh sách việc: khoảng cách đúng theo vị trí quán đã ghim, tin ước tính có dấu ~', async ({ browser }) => {
  const employer = await seedUser('employer', 'Quán Khoảng Cách');
  await seedJob(employer.id, { title: 'Việc đã ghim vị trí', ...pinned(SHOP) });
  await seedJob(employer.id, {
    title: 'Việc chỉ có tọa độ ước tính',
    location: { lat: null, lng: null },
    locationStatus: 'unconfirmed',
    approxLocation: { lat: 21.0128, lng: 105.5455, source: 'geocoded', query: 'test' }, // ~2.1 km về phía đông
  });

  const ctx = await gpsContext(browser);
  const page = await ctx.newPage();
  await page.goto('/jobs');
  const exact = page.locator('[id^="job-card-"]').filter({ hasText: 'Việc đã ghim vị trí' });
  const approx = page.locator('[id^="job-card-"]').filter({ hasText: 'Việc chỉ có tọa độ ước tính' });
  await expect(exact.getByText('Cách 1.0km')).toBeVisible();
  await expect(approx.getByText('Cách ~2.1km')).toBeVisible();
  await ctx.close();
});

test('GPS sai số lớn: cảnh báo và mọi khoảng cách thành ước tính', async ({ browser }) => {
  const employer = await seedUser('employer', 'Quán GPS Thô');
  await seedJob(employer.id, { title: 'Việc với GPS thô', ...pinned(SHOP) });
  const ctx = await gpsContext(browser, 3500);
  const page = await ctx.newPage();
  await page.goto('/jobs');
  await expect(page.getByText(/sai số khoảng ±3\.5 km/)).toBeVisible();
  const card = page.locator('[id^="job-card-"]').filter({ hasText: 'Việc với GPS thô' });
  await expect(card.getByText('Cách ~1.0km')).toBeVisible();
  await ctx.close();
});

test('chi tiết việc: khoảng cách thật từ GPS, không còn số giả 85% / "Gần trường"', async ({ browser }) => {
  const employer = await seedUser('employer', 'Quán Chi Tiết');
  const student = await seedUser('student', 'Sinh Viên GPS');
  const job = await seedJob(employer.id, { title: 'Việc xem chi tiết', ...pinned(SHOP) });
  const ctx = await gpsContext(browser);
  const page = await ctx.newPage();
  await signIn(page, student.email);
  await page.goto(`/jobs/${job.id}`);
  const box = page.locator('.card').filter({ hasText: 'Mức độ phù hợp của bạn' });
  await expect(box.getByText('1.0km', { exact: true })).toBeVisible();
  await expect(box.getByText('Theo vị trí GPS hiện tại')).toBeVisible();
  await expect(box.getByText('85%')).toHaveCount(0);
  await expect(box.getByText('Gần trường')).toHaveCount(0);
  await ctx.close();
});

test('nhà tuyển dụng: tin chưa ghim có lời nhắc, đăng tin mới không ghim bị chặn', async ({ page }) => {
  const employer = await seedUser('employer', 'Quán Chưa Ghim');
  await seedJob(employer.id, { title: 'Tin cũ chưa ghim', location: { lat: null, lng: null }, locationStatus: 'unconfirmed' });
  await signIn(page, employer.email);

  await page.goto('/employer/jobs');
  await expect(page.getByText('Ghim vị trí để sinh viên thấy khoảng cách.')).toBeVisible();

  const { token } = await apiLogin(employer.email);
  const created = await apiCall('/jobs', {
    method: 'POST', token,
    body: { title: 'Tin mới chưa ghim vị trí', salaryAmount: 25000, slots: 1, address: 'Thôn 3, Thạch Hòa' },
  });
  expect(created.status).toBe(400);
  expect(created.body.code).toBe('LOCATION_REQUIRED');
});
