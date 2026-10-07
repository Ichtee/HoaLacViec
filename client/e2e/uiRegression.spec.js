import { test, expect } from '@playwright/test';
import { seedUser, seedJob, seedShift, signIn, apiCall, apiLogin } from './helpers.js';

const MOBILE = { width: 390, height: 844 };

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: trang tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
}

test('dashboard sinh viên đếm đúng ca sắp tới và đơn đang chờ', async ({ page }) => {
  const employer = await seedUser('employer');
  const student = await seedUser('student', 'Sinh Viên Đếm');
  const job = await seedJob(employer.id, {});
  await seedShift({ employerId: employer.id, studentId: student.id, studentName: 'Sinh Viên Đếm', hoursAhead: 26 });
  await seedShift({ employerId: employer.id, studentId: student.id, studentName: 'Sinh Viên Đếm', hoursAhead: 50 });
  const { token } = await apiLogin(student.email);
  const applied = await apiCall('/applications', {
    method: 'POST', token,
    body: { jobId: job.id, studentName: 'Sinh Viên Đếm', phone: '0987654321' },
  });
  expect([200, 201]).toContain(applied.status);

  await signIn(page, student.email);
  await page.goto('/student');
  await expect(page.getByText(/Hôm nay bạn có\s*2 ca làm việc/)).toBeVisible();
  await expect(page.getByText(/1 đơn ứng tuyển đang chờ duyệt/)).toBeVisible();
});

test('dashboard nhà tuyển dụng: nút đăng tin đọc được và đếm đơn mới', async ({ page }) => {
  const employer = await seedUser('employer', 'Quán Hoa');
  const student = await seedUser('student');
  const job = await seedJob(employer.id, {});
  const { token } = await apiLogin(student.email);
  await apiCall('/applications', { method: 'POST', token, body: { jobId: job.id, studentName: 'SV', phone: '0987654321' } });

  await signIn(page, employer.email);
  await page.goto('/employer');
  const cta = page.getByRole('link', { name: /Đăng tin tuyển ca mới/ });
  await expect(cta).toBeVisible();
  const colors = await cta.evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
  expect(colors.fg, 'chữ nút không được trùng màu nền').not.toBe(colors.bg);
  await expect(page.getByText(/1 đơn ứng tuyển mới/)).toBeVisible();
});

test('điện thoại 390px: các trang chính không tràn ngang', async ({ browser }) => {
  test.setTimeout(180000);
  const employer = await seedUser('employer');
  const student = await seedUser('student');
  const job = await seedJob(employer.id, {});
  const publicPages = ['/', '/jobs', `/jobs/${job.id}`, '/tasks', '/blogs', '/login', '/register'];
  const studentPages = ['/student', '/student/shifts', '/student/applications', '/student/profile', '/student/quick-shifts', '/student/messages', '/student/swaps', '/student/alerts'];
  const employerPages = ['/employer', '/employer/jobs', '/employer/applications', '/employer/employees', '/employer/shifts', '/employer/quick-shifts', '/employer/messages'];

  for (const [email, urls] of [[null, publicPages], [student.email, studentPages], [employer.email, employerPages]]) {
    const ctx = await browser.newContext({ viewport: MOBILE });
    await ctx.addInitScript(() => { try { localStorage.setItem('hlv_location_banner_dismissed', '1'); } catch { /* */ } });
    const page = await ctx.newPage();
    if (email) await signIn(page, email);
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(700);
      await expectNoHorizontalOverflow(page, url);
    }
    await ctx.close();
  }
});
