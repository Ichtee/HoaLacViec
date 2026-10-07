import { test, expect } from '@playwright/test';
import { seedUser, seedJob, seedEmployment, seedShift, signIn, apiLogin, apiCall } from './helpers.js';

test('ca làm: vào ca -> tan ca -> duyệt công -> chốt lương -> thanh toán -> đánh giá -> xuất bảng lương', async ({ page }) => {
  const employer = await seedUser('employer');
  const student = await seedUser('student', 'Trần Thị Ca Làm');
  const job = await seedJob(employer.id);
  await seedEmployment(employer.id, student.id, job.id);
  // Ca bắt đầu 1 giờ trước, đã công bố
  const shift = await seedShift({ employerId: employer.id, studentId: student.id, studentName: 'Trần Thị Ca Làm', hoursAhead: -1 });

  await signIn(page, employer.email);
  await page.goto('/employer/shifts');
  await expect(page.getByText('Trần Thị Ca Làm').first()).toBeVisible();

  await page.getByRole('button', { name: /Ghi nhận vào ca/ }).click();
  await expect(page.getByText('Đã ghi nhận nhân viên vào ca.')).toBeVisible();

  await page.getByRole('button', { name: /Ghi nhận tan ca/ }).click();
  await expect(page.getByText('Đã ghi nhận tan ca.')).toBeVisible();

  await page.getByRole('button', { name: /Duyệt chốt công/ }).click();
  await expect(page.getByText(/Đã xác nhận duyệt công/)).toBeVisible();

  await page.getByRole('button', { name: 'Chốt lương' }).click();
  await expect(page.getByText('Đã chốt lương cho ca này.')).toBeVisible();

  await page.getByRole('button', { name: 'Xác nhận đã thanh toán' }).click();
  await expect(page.getByText('Đã xác nhận thanh toán.')).toBeVisible();
  await expect(page.getByText('Đã thanh toán').first()).toBeVisible();

  // Trạng thái phía máy chủ khớp với những gì giao diện hiển thị
  const token = (await apiLogin(employer.email)).token;
  const list = await apiCall('/shifts', { token });
  const stored = list.body.find((s) => (s._id || s.id) === shift.id);
  expect(stored.attendanceStatus).toBe('approved');
  expect(stored.payrollStatus).toBe('paid');
  expect(stored.totalPay).toBeGreaterThan(0);

  // Đánh giá nhân viên
  await page.getByRole('button', { name: /Đánh giá nhân viên/ }).click();
  await page.getByRole('button', { name: 'Đánh giá tổng thể *: 5 sao' }).click();
  await page.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(page.getByText('Đã gửi đánh giá nhân viên.')).toBeVisible();
  await expect(page.getByText('Đã đánh giá').first()).toBeVisible();

  // Xuất bảng lương CSV
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Xuất bảng lương/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^bang-luong-\d{4}-\d{2}\.csv$/);
  const csv = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  expect(csv).toContain('Trần Thị Ca Làm');
  expect(csv).toContain('Đã thanh toán');

  // Sinh viên thấy đánh giá nhận được và hồ sơ làm việc cập nhật
  const studentPage = await page.context().newPage();
  await signIn(studentPage, student.email);
  await studentPage.goto('/student/reviews');
  await expect(studentPage.getByText('Đánh giá từ cửa hàng (1)')).toBeVisible();
  await studentPage.goto('/student/profile');
  await expect(studentPage.getByText('Ca đã hoàn thành')).toBeVisible();
});
