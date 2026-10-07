import { test, expect } from '@playwright/test';
import { seedUser, seedJob, signIn, apiCall } from './helpers.js';

test('tin chờ duyệt chỉ hiển thị công khai sau khi quản trị viên phê duyệt', async ({ page }) => {
  const title = `Barista E2E ${Date.now().toString(36)}`;
  const employer = await seedUser('employer');
  const admin = await seedUser('admin');
  const job = await seedJob(employer.id, { title, status: 'pending' });

  // Chưa duyệt: danh sách công khai không có tin này
  const before = await apiCall('/jobs');
  const listed = (body) => JSON.stringify(body).includes(job.id);
  expect(listed(before.body)).toBe(false);

  await signIn(page, admin.email);
  await page.goto('/admin/jobs');
  const card = page.getByText(title).first().locator('xpath=ancestor::div[.//button[contains(., "Phê duyệt")]][1]');
  await card.getByRole('button', { name: /Phê duyệt/ }).click();
  await expect(page.getByText(/Đã duyệt bài đăng/)).toBeVisible();

  // Đã duyệt: hiển thị trên danh sách công khai và trang chi tiết
  const after = await apiCall('/jobs');
  expect(listed(after.body)).toBe(true);
  await page.goto(`/jobs/${job.id}`);
  await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
});

test('nhà tuyển dụng đã duyệt xem được tin, người lạ không sửa được tin của người khác', async () => {
  const owner = await seedUser('employer');
  const other = await seedUser('employer');
  const job = await seedJob(owner.id, { title: `Tin riêng ${Date.now().toString(36)}` });
  const { apiLogin } = await import('./helpers.js');
  const otherToken = (await apiLogin(other.email)).token;
  const res = await apiCall(`/jobs/${job.id}`, { method: 'PUT', token: otherToken, body: { title: 'Bị chiếm' } });
  expect([403, 404]).toContain(res.status);
  const check = await apiCall(`/jobs/${job.id}`);
  expect(check.body.title).not.toBe('Bị chiếm');
});
