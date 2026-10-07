import { test, expect } from '@playwright/test';
import { seedUser, seedJob, signIn, apiCall, apiLogin } from './helpers.js';

test('ứng tuyển -> sàng lọc -> offer -> nhận việc: tạo nhân viên và trừ chỉ tiêu', async ({ page }) => {
  const title = `Phục vụ E2E ${Date.now().toString(36)}`;
  const employer = await seedUser('employer');
  const student = await seedUser('student', 'Nguyễn Văn E2E');
  const job = await seedJob(employer.id, { title });

  // 1) Sinh viên nộp đơn trên giao diện
  await signIn(page, student.email);
  await page.goto(`/jobs/${job.id}`);
  await page.getByRole('button', { name: /Ứng tuyển ngay/ }).click();
  await page.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill('Nguyễn Văn E2E');
  await page.getByPlaceholder('Ví dụ: 0987654321').fill('0987654321');
  for (const select of await page.getByRole('dialog').locator('select').all()) {
    const options = await select.locator('option').count();
    if (options > 1 && !(await select.inputValue())) await select.selectOption({ index: 1 });
  }
  await page.getByRole('button', { name: /Xác nhận nộp đơn/ }).click();
  await expect(page.getByRole('button', { name: /Xác nhận nộp đơn/ })).toBeHidden();

  const studentToken = (await apiLogin(student.email)).token;
  const mine = await apiCall('/applications', { token: studentToken });
  expect(mine.body).toHaveLength(1);
  expect(mine.body[0].status).toBe('submitted');

  // 2) Nhà tuyển dụng: sàng lọc rồi gửi offer
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const employerPage = await page.context().newPage();
  await signIn(employerPage, employer.email);
  await employerPage.goto('/employer/applications');
  await employerPage.getByRole('button', { name: 'Chuyển sang Sàng lọc' }).first().click();
  await expect(employerPage.getByRole('button', { name: /Gửi Offer nhận việc/ }).first()).toBeVisible();
  await employerPage.getByRole('button', { name: /Gửi Offer nhận việc/ }).first().click();
  await employerPage.getByRole('button', { name: /Gửi Đề nghị nhận việc/ }).click();
  await expect(employerPage.getByText(/Đã gửi Offer/).first()).toBeVisible();

  // 3) Sinh viên chấp nhận trên giao diện
  const studentPage = await page.context().newPage();
  await signIn(studentPage, student.email);
  await studentPage.goto('/student/applications');
  await studentPage.getByRole('button', { name: /Đồng ý nhận việc/ }).click();
  await expect(studentPage.getByText(/chính thức trở thành nhân viên/)).toBeVisible();

  // 4) Kết quả phía máy chủ: nhân viên được tạo, chỉ tiêu bị trừ đúng một lần
  const employerToken = (await apiLogin(employer.email)).token;
  const employments = await apiCall('/employments', { token: employerToken });
  expect(JSON.stringify(employments.body)).toContain(student.id);
  const after = await apiCall(`/jobs/${job.id}`);
  expect(after.body.hiredCount).toBe(1);
  expect(after.body.remainingOpenings).toBe(1);
});
