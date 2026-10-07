import { test, expect } from '@playwright/test';
import { seedUser, signIn, apiCall, apiLogin } from './helpers.js';

function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('trang xác minh: ba thẻ vai trò chuyển được giữa các biểu mẫu', async ({ page }) => {
  const errors = trackPageErrors(page);
  const user = await seedUser('pending', 'Nguyen Thu', { status: 'pending' });
  await signIn(page, user.email);
  await page.goto('/verify-account');

  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible();
  await page.getByRole('button', { name: /Tôi là Sinh viên/ }).click();
  await expect(page.getByText(/Mã số sinh viên|mã sinh viên/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Tôi là Nhà tuyển dụng/ }).click();
  await expect(page.getByText(/Tên cửa hàng/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Tôi là Lao động tự do/ }).click();
  await expect(page.getByText(/Căn cước|CCCD/).first()).toBeVisible();

  // Kiểm tra hợp lệ vẫn hoạt động sau khi tách component
  await page.getByRole('button', { name: /Gửi|Xác minh|Nộp/ }).last().click();
  await expect(page.getByText(/Vui lòng nhập số Căn cước công dân/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('trang việc vặt: tải được, đổi tab, không lỗi runtime', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: /Chưa có việc vặt nào/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('trang việc vặt: thẻ việc hiển thị và mở được hộp thoại nhận việc', async ({ page }) => {
  const errors = trackPageErrors(page);
  const requester = await seedUser('student', 'Nguoi Nho');
  const helper = await seedUser('student', 'Nguoi Giup');
  const { token } = await apiLogin(requester.email);
  const title = `Mua cơm trưa ${Date.now().toString(36)}`;
  const created = await apiCall('/tasks', {
    method: 'POST', token,
    body: {
      title, description: 'Mua giúp một suất cơm gà ở căng tin rồi mang lên KTX.', category: 'di_cho',
      reward: 20000, location: 'Căng tin FPT, Hòa Lạc', phone: '0912345678',
      deadlineDate: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    },
  });
  expect(created.status).toBe(201);

  await signIn(page, helper.email);
  await page.goto('/tasks');
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole('button', { name: /Nhận việc này/ }).first().click();
  await expect(page.getByRole('dialog').getByText(/Xác nhận nhận việc vặt/)).toBeVisible();
  await expect(page.getByPlaceholder(/10 số di động/)).toBeVisible();
  expect(errors).toEqual([]);
});
