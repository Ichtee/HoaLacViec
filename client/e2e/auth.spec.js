import { test, expect } from '@playwright/test';
import { seedUser, PASSWORD } from './helpers.js';

test.describe('Đăng nhập và phân quyền', () => {
  test('mỗi vai trò đăng nhập qua form và vào đúng khu vực của mình', async ({ page }) => {
    const student = await seedUser('student');
    const employer = await seedUser('employer');

    await page.goto('/login');
    await page.getByPlaceholder(/name@student/).fill(student.email);
    await page.getByPlaceholder(/Nhập mật khẩu/).fill(PASSWORD);
    await page.getByRole('button', { name: /Đăng nhập/ }).click();
    await expect(page).toHaveURL(/\/student/);

    // Đăng nhập lại bằng nhà tuyển dụng trên một phiên sạch
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/login');
    await page.getByPlaceholder(/name@student/).fill(employer.email);
    await page.getByPlaceholder(/Nhập mật khẩu/).fill(PASSWORD);
    await page.getByRole('button', { name: /Đăng nhập/ }).click();
    await expect(page).toHaveURL(/\/employer/);
  });

  test('sai mật khẩu hiển thị lỗi và không đăng nhập', async ({ page }) => {
    const student = await seedUser('student');
    await page.goto('/login');
    await page.getByPlaceholder(/name@student/).fill(student.email);
    await page.getByPlaceholder(/Nhập mật khẩu/).fill('SaiMatKhau1');
    await page.getByRole('button', { name: /Đăng nhập/ }).click();
    await expect(page.getByText(/không chính xác/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sinh viên không vào được khu vực quản trị và nhà tuyển dụng', async ({ page }) => {
    const student = await seedUser('student');
    await page.goto('/login');
    await page.getByPlaceholder(/name@student/).fill(student.email);
    await page.getByPlaceholder(/Nhập mật khẩu/).fill(PASSWORD);
    await page.getByRole('button', { name: /Đăng nhập/ }).click();
    await expect(page).toHaveURL(/\/student/);

    await page.goto('/admin');
    await expect(page.getByText(/yêu cầu quyền Quản trị viên/)).toBeVisible();

    await page.goto('/employer');
    await expect(page).toHaveURL(/\/student/);
  });

  test('chưa đăng nhập bị chuyển về trang đăng nhập', async ({ page }) => {
    await page.goto('/student/applications');
    await expect(page).toHaveURL(/\/login/);
  });
});
